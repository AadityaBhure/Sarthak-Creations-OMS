import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const updates = await request.json();
    
    const supabase = createServerClient();

    // Fetch current order to see if it changed and to build the old state map
    const { data: currentOrder } = await supabase
      .from('orders')
      .select(`
        *,
        clients (name),
        product_names (name)
      `)
      .eq('id', id)
      .single();

    // Manually fetch user if exists (to avoid foreign key errors)
    if (currentOrder && currentOrder.executive_id) {
      const { data: execData } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', currentOrder.executive_id)
        .single();
      currentOrder.users = execData;
    }

    // Intercept executive_id changes to inject history into remarks
    if (updates.executive_id !== undefined) {
      if (currentOrder && updates.executive_id !== currentOrder.executive_id) {
        let oldName = 'Unassigned';
        let newName = 'Unassigned';

        // Fetch old executive name
        if (currentOrder.executive_id) {
          const { data: oldExec } = await supabase.from('users').select('first_name').eq('id', currentOrder.executive_id).single();
          if (oldExec) oldName = oldExec.first_name;
        }

        // Fetch new executive name
        if (updates.executive_id) {
          const { data: newExec } = await supabase.from('users').select('first_name').eq('id', updates.executive_id).single();
          if (newExec) newName = newExec.first_name;
        }

        // Append to existing assignment_history, chaining the history
        let existingHistory = currentOrder.assignment_history || '';
        
        const assignmentRegex = /\[Assignment:\s*(.*?)\]/g;
        let match;
        let lastMatch = null;
        while ((match = assignmentRegex.exec(existingHistory)) !== null) {
          lastMatch = match;
        }

        if (lastMatch) {
          const content = lastMatch[1];
          const newBlock = `[Assignment: ${content} -> ${newName}]`;
          updates.assignment_history = existingHistory.substring(0, lastMatch.index) + newBlock + existingHistory.substring(lastMatch.index + lastMatch[0].length);
        } else {
          const assignmentRemark = `[Assignment: ${oldName} -> ${newName}]`;
          updates.assignment_history = existingHistory ? existingHistory + '\n' + assignmentRemark : assignmentRemark;
        }
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      const changes = {};
      
      if (currentOrder) {
        // Build "Old" map resolved to human readable names
        const oldMap = {
          'PO Number': currentOrder.po_number,
          'Status': currentOrder.status,
          'Target Date': currentOrder.target_date,
          'Quantity': currentOrder.quantity,
          'Client': currentOrder.clients?.name || 'Unknown',
          'Product': currentOrder.product_names?.name || 'Unknown',
          'Assigned Executive': currentOrder.users ? `${currentOrder.users.first_name} ${currentOrder.users.last_name || ''}`.trim() : 'Unassigned',
          'Remarks': currentOrder.remark,
          'Assignment History': currentOrder.assignment_history
        };

        // Build "New" map resolved to human readable names
        const newMap = { ...oldMap };

        if (updates.po_number !== undefined) newMap['PO Number'] = updates.po_number;
        if (updates.status !== undefined) newMap['Status'] = updates.status;
        if (updates.target_date !== undefined) newMap['Target Date'] = updates.target_date;
        if (updates.quantity !== undefined) newMap['Quantity'] = updates.quantity;
        if (updates.remark !== undefined) newMap['Remarks'] = updates.remark;
        if (updates.assignment_history !== undefined) newMap['Assignment History'] = updates.assignment_history;

        // Resolve new IDs to names if they changed
        if (updates.client_id && updates.client_id !== currentOrder.client_id) {
          const { data: c } = await supabase.from('clients').select('name').eq('id', updates.client_id).single();
          newMap['Client'] = c?.name || 'Unknown';
        }
        if (updates.product_id && updates.product_id !== currentOrder.product_id) {
          const { data: p } = await supabase.from('product_names').select('name').eq('id', updates.product_id).single();
          newMap['Product'] = p?.name || 'Unknown';
        }
        if (updates.executive_id !== undefined && updates.executive_id !== currentOrder.executive_id) {
          if (updates.executive_id) {
            const { data: u } = await supabase.from('users').select('first_name, last_name').eq('id', updates.executive_id).single();
            newMap['Assigned Executive'] = u ? `${u.first_name} ${u.last_name || ''}`.trim() : 'Unassigned';
          } else {
            newMap['Assigned Executive'] = 'Unassigned';
          }
        }

        // Compare
        for (const key of Object.keys(oldMap)) {
          if (oldMap[key] !== newMap[key]) {
            changes[key] = { old: oldMap[key], new: newMap[key] };
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: payload.userId || null,
          username: payload.username || 'Admin',
          action: 'UPDATE',
          module: currentOrder?.status === 'Completed' ? 'Completed Orders' : 'Active Orders',
          recordId: id,
          details: changes
        });
      }
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // 1. Fetch the original order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Upsert into deleted_orders
    const { error: insertError } = await supabase
      .from('deleted_orders')
      .upsert([order]);

    if (insertError) throw insertError;

    // 3. Delete from active orders
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // ROLLBACK: Clean up the ghost copy from the trash if deletion fails
      await supabase.from('deleted_orders').delete().eq('id', id);
      throw deleteError;
    }

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      await logActivity({
        userId: payload.userId || null,
        username: payload.username || 'Admin',
        action: 'DELETE',
        module: order?.status === 'Completed' ? 'Completed Orders' : 'Active Orders',
        recordId: id,
        details: { po_number: order.po_number }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
