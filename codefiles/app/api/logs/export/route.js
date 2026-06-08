import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = createServerClient();
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (from) {
      query = query.gte('created_at', `${from}T00:00:00.000Z`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const exportData = data.map(log => {
      let detailsString = '';
      try {
        if (log.details) {
          if (typeof log.details === 'object') {
            // Format keys beautifully: "phone_number" -> "Phone Number"
            const formatKey = (k) => k.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            // Helper to stringify arrays/objects gracefully
            const stringifyValue = (val) => {
              if (val === null || val === undefined) return 'none';
              if (typeof val === 'object') {
                try {
                  return JSON.stringify(val);
                } catch (e) {
                  return String(val);
                }
              }
              return String(val);
            };

            if (log.action === 'DELETE') {
              detailsString = Object.entries(log.details)
                .map(([k, v]) => `deleted with ${formatKey(k)} "${stringifyValue(v)}"`)
                .join(' | ');
            } else {
              detailsString = Object.entries(log.details)
                .map(([k, v]) => {
                  const prettyKey = formatKey(k);
                  if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'old' in v && 'new' in v) {
                    return `changed ${prettyKey} from '${stringifyValue(v.old)}' to '${stringifyValue(v.new)}'`;
                  }
                  return `set ${prettyKey} to '${stringifyValue(v)}'`;
                })
                .join(' | ');
            }
          } else {
            detailsString = String(log.details);
          }
        }
      } catch (e) {
        detailsString = 'Error parsing details';
      }

      const actor = log.username || 'System';
      const actionName = log.action ? log.action.toLowerCase() : 'modified';
      const moduleName = log.module || 'a record';
      
      const humanReadableDesc = `${actor} ${actionName} a record in ${moduleName}.`;

      return {
        'Date & Time': new Date(log.created_at).toLocaleString(),
        'User': actor,
        'Action': log.action,
        'Module': log.module,
        'Description': humanReadableDesc,
        'Changes / Details': detailsString || 'No specific details recorded.',
        'System Record ID': log.record_id || '',
        'System Log ID': log.id
      };
    });

    let csv = '';
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      csv += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
      
      exportData.forEach(row => {
        csv += headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',') + '\n';
      });
    } else {
      csv = 'No logs found for the selected date range.';
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="activity_logs_${Date.now()}.csv"`
      }
    });

  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
