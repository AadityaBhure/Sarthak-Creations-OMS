import { createServerClient } from '@/lib/supabaseClient';

/**
 * Logs a user action into the activity_logs table.
 * @param {Object} params
 * @param {string} params.userId - The ID of the user performing the action
 * @param {string} params.username - The username of the user performing the action
 * @param {string} params.action - CREATE, UPDATE, DELETE
 * @param {string} params.module - The module name (e.g., 'orders', 'clients')
 * @param {string} params.recordId - The ID of the record being modified
 * @param {Object} [params.details] - Optional JSON object detailing the changes
 */
export async function logActivity({ userId, username, action, module, recordId, details = null }) {
  try {
    const supabase = createServerClient();
    
    // We do not want to block the main request if logging fails, so we swallow errors
    const { error } = await supabase
      .from('activity_logs')
      .insert([
        {
          user_id: userId,
          username: username,
          action,
          module,
          record_id: recordId,
          details
        }
      ]);
      
    if (error) {
      console.error('[logActivity Error]', error.message);
      try {
        require('fs').appendFileSync('C:\\\\Users\\\\LOQ\\\\.gemini\\\\antigravity\\\\brain\\\\b7f93852-94e0-4b9c-8115-b123c15ca502\\\\scratch\\\\log_error.txt', new Date().toISOString() + ' ERROR: ' + error.message + '\\n');
      } catch(e){}
    }
  } catch (err) {
    console.error('[logActivity Exception]', err);
    try {
        require('fs').appendFileSync('C:\\\\Users\\\\LOQ\\\\.gemini\\\\antigravity\\\\brain\\\\b7f93852-94e0-4b9c-8115-b123c15ca502\\\\scratch\\\\log_error.txt', new Date().toISOString() + ' EXCEPTION: ' + err.message + '\\n');
    } catch(e){}
  }
}
