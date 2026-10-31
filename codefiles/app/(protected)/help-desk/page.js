'use client';

import { useGlobalSettings } from '@/components/SettingsProvider';

function Steps({ children }) {
  return <ol style={{ paddingLeft: 20, margin: '8px 0', lineHeight: 1.7 }}>{children}</ol>;
}

function Section({ id, title, intro, rows }) {
  return (
    <section id={id} style={{ scrollMarginTop: 80 }}>
      <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{title}</h3>
      {intro && <p style={{ lineHeight: 1.7, marginBottom: 16, color: 'var(--text-secondary)' }}>{intro}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th scope="col" style={{ width: '25%' }}>Topic / Rule</th><th scope="col" style={{ width: '75%' }}>How it Works & What to Do</th></tr></thead>
          <tbody>{rows.map(([label, explanation]) => <tr key={label}>
            <th scope="row" style={{ verticalAlign: 'top', textAlign: 'left', fontWeight: 600, whiteSpace: 'normal', lineHeight: 1.6, textTransform: 'none', letterSpacing: 'normal' }}>{label}</th>
            <td style={{ verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{explanation}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <a href="#help-top" style={{ fontSize: 13, textDecoration: 'underline' }}>Back to contents</a>
    </section>
  );
}

export default function HelpDeskPage() {
  const { settings } = useGlobalSettings();
  const retention = settings?.recycle_retention_days ?? 10;
  const sections = [
    {
      id: 'finding-your-way', title: '1. Finding Your Way Around',
      intro: 'The system has two separate work areas. Choose the one that matches the work you are recording. A client is the customer placing an order; a vendor is the business carrying out a job.',
      rows: [
        ['Client Progress Tracking — Module 1', <>Use this for customer orders: who ordered, their PO Number, the product, quantity, assigned executive, target date and production status. <strong>Orders</strong> contains Order List, Completed Orders and New Order. <strong>Masters</strong> contains Executive List, Client List, Product Lists and Product Types.</>],
        ['Vendor Job Tracking — Module 2', <>Use this to follow a batch of work as it moves between vendors and job stages. <strong>Jobs</strong> contains New Job Card, Active Jobs, Completed Jobs and Canceled Jobs. <strong>Masters</strong> contains Vendors, Job Types and Paper Types. A Job Card records one batch quantity and its vendor history.</>],
        ['Show or hide sidebar groups', <>Click <strong>Orders</strong>, <strong>Jobs</strong> or <strong>Masters</strong>, or its arrow, to show or hide that group’s links. Each group works independently. Hiding a group only tidies the menu; it does not delete records or stop work. The browser remembers which groups you leave expanded or collapsed, including after a reload or hiding and reopening the sidebar. A new browser starts with the groups expanded.</>],
        ['Two Deleted Records pages', <>Each module has its own <strong>Deleted Records</strong> link below its groups. Use the link under Client Progress Tracking for deleted customer orders and its masters. Use the link under Vendor Job Tracking for deleted Job Cards and vendor masters. These links remain visible when the groups are collapsed.</>],
        ['The modules do not update each other', <>Creating or completing an Order does not automatically create or complete a Job Card. The two modules use separate records and master lists. For example, a Product Type in Module 1 is not a Paper Type in Module 2. Enter and update each record where required.</>],
        ['What is a master?', <>A master is a reusable list used in dropdowns, such as customers or paper names. Add a name to the correct master first, then select it when creating work. This avoids repeatedly typing the same details. A master record is not itself an Order or a Job Card.</>],
      ],
    },
    {
      id: 'client-masters', title: '2. Module 1 — Prepare Your Master Lists',
      rows: [
        ['Executive List', <>Executives are staff accounts that can be assigned to orders. Use clear names and the correct account details. Before deleting an executive, reassign any orders that still use that person. <strong>Executives do not have a restore tab on the current Deleted Records page.</strong> Ask the administrator before deleting a staff account; do not assume you can restore it yourself.</>],
        ['Client List', <>Add the customer’s name and, where available, contact person and phone number. Use one consistent spelling for each customer. For example, search for “ABC Packaging” before adding it again with a slightly different spelling.</>],
        ['Product Lists and Product Types', <>A <strong>Product List</strong> is the named product, such as “ABC 500 g Carton”, and can be linked to a client. A <strong>Product Type</strong> is the broader category, such as “Carton”. These are separate choices on an order. Check the client link when setting up a product.</>],
        ['Recommended setup order', <Steps><li>Create executives who will be assigned work.</li><li>Add clients.</li><li>Add Product Lists and link them to the appropriate clients.</li><li>Add Product Types.</li><li>Open New Order and select these saved records.</li></Steps>],
        ['Correcting master details', <>Use the page’s Add button for a new record. To correct existing details, turn on <strong>Editable</strong>, make your changes and use <strong>Save Changes</strong>. Use <strong>Discard</strong> to cancel unsaved edits. Renaming a master can change the name shown wherever that master is used; check whether you mean to rename an existing item or add a genuinely different one.</>],
      ],
    },
    {
      id: 'client-orders', title: '3. Module 1 — Create and Update Customer Orders',
      rows: [
        ['Three different numbers', <>The <strong>PO Number</strong> is the customer’s reference and works as before. <strong>Order Number</strong> is your business’s editable number. <strong>Serial Number</strong> is assigned automatically when an order is saved and cannot be changed. Each customer order gets its own Serial Number, even when two Order Numbers match.</>],
        ['How Order Numbers continue', <>New Order suggests the next number, initially 1. You can change it before saving: saving a new order as 10 makes the next suggestion 11. Changing an older order’s number does not change the next suggestion. Existing orders start with a blank Order Number; turn on Editable in Order List or Completed Orders to fill these in. If another person saves first, review the refreshed suggestion and save again.</>],
        ['Duplicate Order Numbers', <>If an Order Number has already been used, a warning appears. Choose Cancel to correct it, or Continue Anyway if the duplicate is intentional. This creates or edits a separate order; it does not merge records. Deleted records also reserve their last Order Number for this warning, including after permanent deletion.</>],
        ['Permanent Serial Numbers', <>Customer orders use Serial Number; vendor Job Cards call this permanent number Count. Each module has its own sequence starting at 1. Existing records receive numbers oldest first, including completed records and recoverable deleted records. A record keeps its number when edited, completed, deleted or restored. Permanent deletion does not free the number for reuse. Serial Number identifies the record across its lifetime; a row number only indicates its current position in a table. The highest Serial Number reflects how many records have been numbered in that module, including those subsequently deleted. Records already permanently deleted before this feature was installed cannot be counted.</>],
        ['Create an order', <Steps><li>Open <strong>Client Progress Tracking → Orders → New Order</strong>.</li><li>Check Date of Entry and enter the customer’s PO Number.</li><li>Select the Client, Product List and Product Type. Select the client first so the product choices can be narrowed appropriately.</li><li>Enter the quantity, review the status, and choose an executive if required.</li><li>Add a target date and remarks where needed.</li><li>Click <strong>Save Order</strong>, or <strong>Save & Add Another</strong> to continue entering orders.</li></Steps>],
        ['Required and optional details', <>Fields marked with <strong>*</strong> must be completed. An order needs its date, PO Number, client, product, product type and quantity. Review the selected status before saving. Executive assignment, target date and remarks can be left blank when not needed. “Unassigned” means no executive has been selected.</>],
        ['Target date: date or number of days', <>You can choose a target date directly or enter the number of days allowed. The days option counts forward from the <strong>Date of Entry</strong>, not necessarily from today. For example, an entry dated 1 October with 5 days allowed gives a target date of 6 October.</>],
        ['Change an order’s status', <>Find the order in <strong>Order List</strong>. Its coloured status control is a dropdown. Choose the next status and click <strong>Save Changes</strong>. The list of Module 1 statuses comes from Settings. Selecting a new value without saving does not finish the update.</>],
        ['Edit other details', <>Turn on <strong>Editable</strong> to correct fields such as quantity, client, target date, executive or remarks. Changed cells remain pending until you save. <strong>Discard</strong> removes those pending changes; it does not undo an earlier successful save. Check any error message before leaving the page.</>],
        ['Completed Orders', <>An order with status <strong>Completed</strong> appears in Completed Orders instead of Order List. This is different from deletion: the order is still available. The Completed Orders page also supports editing and status changes. If work resumes, choose the appropriate non-completed status and save; the order returns to Order List.</>],
        ['Executive assignment history', <>When the assigned executive changes, the system adds to <strong>In-Charge (History)</strong>, for example “John → Jane”. This history is stored separately from your ordinary Remarks. It helps explain who handled the order previously.</>],
        ['Check PO Numbers before saving', <>Use the customer’s actual PO Number and review existing orders when unsure. Do not treat a PO Number as an automatically generated Job Card number: the two modules have different numbering behaviour. A similar-looking number is not a reason to assume two records are the same.</>],
      ],
    },
    {
      id: 'vendor-masters', title: '4. Module 2 — Set Up Vendors, Job Types and Paper Types',
      rows: [
        ['Job Types', <>Add the kinds of work performed, such as Printing, Lamination or Cutting. These describe a stage of work; they are not the card’s Active/Hold/Completed/Canceled status. Create them before assigning vendor capabilities or importing vendors that mention them.</>],
        ['Vendors', <>A vendor has a required <strong>Vendor Name</strong> and optional Address, Concerned Person(s), Concerned Person Contact(s), and Job Capabilities. Keep phone numbers as text so prefixes and leading zeroes are retained. If you list several people and contacts, keep them in corresponding order.</>],
        ['Job Capabilities', <>Capabilities describe the work a vendor usually performs. In the New Job Card form, that vendor’s listed capabilities are shown first among Job Type choices. They are <strong>guidance, not a strict restriction</strong>: another active Job Type may still be selected. Confirm that the chosen vendor can actually do the work.</>],
        ['Paper Types', <>This master currently stores a <strong>Paper Type Name</strong> only, such as Art Paper, Maplitho or Duplex Board. There are no separate GSM, size, price or vendor fields in this master. If your team includes a specification in the name, use the same naming convention consistently.</>],
        ['Sarthak Creations and repeat visits', <>Sarthak Creations is a vendor record used for work handled internally. It can appear at any position in a job’s history, just like another vendor. The same vendor may appear more than once when a batch returns for another stage.</>],
        ['Names and editing', <>Vendor, Job Type and Paper Type names must contain 1–200 characters. Capitalisation alone does not make a new name: “ABC Print” and “abc print” count as the same name. Save or discard pending edits before starting an import or opening Deleted Records. Renaming a master also updates its displayed name in existing job history.</>],
        ['“This name already exists” after deletion', <>Module 2 keeps a deleted master’s name reserved. Open <strong>Vendor Job Tracking → Deleted Records</strong>, choose its tab and restore the existing record. Adding a name that matches a deleted master can also offer Restore. That restores its <strong>saved details and history</strong>; details typed into the Add form do not replace them. Edit the restored record afterwards if needed.</>],
      ],
    },
    {
      id: 'new-job-card', title: '5. Module 2 — Create a New Job Card',
      rows: [
        ['Job Title and Product Type', <>Both are optional. <strong>Job Title</strong> is a nickname of up to 200 characters, such as “Diwali gift boxes”. It does not replace the Job Card Number or Count. <strong>Product Type</strong> uses the existing master under Client Progress Tracking → Masters → Product Types; there is no second master to maintain. It describes the finished product, while Paper Type describes the material and Job Type describes the work. Existing cards start with these fields blank.</>],
        ['Correcting a title or product type', <>In Active Jobs, turn on <strong>Editable</strong>, change Job Title or Product Type and click Save Changes. Clear the dropdown to remove a Product Type. For a completed or canceled card, send it back to Active before editing. Both fields appear in the job tables and their exports, and remain visible in Deleted Records. Renaming an existing Product Type updates the displayed name on linked cards. If that master is deleted, existing cards retain its last name, but it cannot be selected for a new card.</>],
        ['Count versus Job Card Number', <>The Job Card Number continues to work as before. A separate <strong>Count</strong> is assigned automatically when you save and cannot be edited. Count increases by 1 for each new Job Card and cannot be reset or reused, even after permanent deletion. This sequence is independent of customer orders. The same card keeps its Count when completed, reopened, deleted or restored. You can find it in Active Jobs, Completed Jobs, Canceled Jobs and Deleted Records.</>],
        ['Create a card', <Steps><li>Open <strong>Vendor Job Tracking → Jobs → New Job Card</strong>.</li><li>Review the suggested Job Card Number and Date of Entry.</li><li>Enter the batch quantity and select its Paper Type.</li><li>Select the first Vendor and Job Type.</li><li>Add any remarks, then save. Use <strong>Save & Add Another</strong> if entering several cards.</li></Steps>],
        ['One card follows one batch', <>Quantity must be a positive whole number. The first vendor/job stage is created with the card. Later movements belong in that card’s history; do not create a new card merely because the same batch has moved to another vendor. There is no separate quantity for each stage.</>],
        ['Automatic number or manual number', <>The form suggests a number such as <strong>JB0001</strong>. You may replace it with your own number. If another employee takes the suggested number before you save, the system asks you to review a refreshed suggestion. Check the new number and save again.</>],
        ['Duplicate Job Card Number warning', <>When creating a card, changing its number or sending a completed or canceled card back to Active, the system checks for matching numbers in <strong>Active Jobs</strong>. If a warning appears, Cancel lets you correct it. <strong>Continue Anyway</strong> deliberately allows a separate card with the same displayed number; it does not merge records. Only continue when the duplicate is intended.</>],
        ['Date of Entry versus first-stage time', <>Date of Entry is editable. Leaving the suggested date unchanged keeps the supplied time; changing the date records the start of that date in India Standard Time. The first stage normally receives the time you save. Backdating the entry date therefore does <strong>not</strong> also backdate the first stage. Use Edit Sequence later if a stage time needs correction.</>],
        ['Missing dropdown choices', <>Check the correct Module 2 master first. A deleted vendor, job type or paper is not available for new selections. Restore it from Module 2’s Deleted Records, or add a genuinely new master, then reload the form after saving any work you need to keep.</>],
      ],
    },
    {
      id: 'job-progress', title: '6. Module 2 — Move Work, Correct History and Complete Jobs',
      rows: [
        ['Vendor-wise Ledger', <>Open <strong>Vendor Job Tracking → Jobs → Vendor-wise Ledger</strong> to see the saved work for each vendor. Select a vendor, or leave the selection blank for all vendors. Each saved stage is a separate row. If a card goes to Vendor A, then Vendor B, then Vendor A again, Vendor A has two entries. The Work / Job Type column describes that visit, even if another vendor is now handling the card. This is a work history report, not a payment or balance ledger.</>],
        ['Reading and exporting the ledger', <>Stage No. is the visit’s position in its Job Card sequence, and Stage Date / Time is its saved start time in India time. Job Card details and status show their current values. <strong>Batch Quantity repeats for each visit; do not add these rows as if they were separate orders.</strong> Use filters, sorting and Rows per page to find work. CSV and PDF export selected visits, or the current page if none are selected, using visible columns. Print uses the current page.</>],
        ['Deleted work and corrections in the ledger', <>All four job statuses are included. Enable <strong>Include Job Cards in Deleted Records</strong> to include recoverable deleted cards; deleted vendors can still be selected for historical searches. Permanently purged cards no longer have saved history to show. Correcting, reordering or removing a stage in Edit Sequence also changes the ledger. Only saved stages appear—unsaved dropdown changes do not create ledger entries. Click Refresh after changing a Job Card elsewhere.</>],
        ['Four job statuses', <>New cards start as <strong>Active</strong>. Active and <strong>Hold</strong> cards appear together in Active Jobs. <strong>Completed</strong> cards appear in Completed Jobs, and <strong>Canceled</strong> cards appear in Canceled Jobs. Choose the status in the row and click Save Changes. A selection is only pending until saved.</>],
        ['Put a job on Hold', <>Choose <strong>Hold</strong> and save. The job stays in Active Jobs with an amber Hold label. This is a visible reminder only: it does not stop day counters, add a vendor stage, move the record or disable editing. Choose Active and save when work resumes, or complete or cancel the job as appropriate. Its Job Card Number still counts in duplicate checks for Active Jobs.</>],
        ['Cancel a job', <>Choose <strong>Cancel Job</strong> and save. The record moves to Canceled Jobs with all its details, Count and history intact. Its day counters stop at cancellation. Cancellation is not deletion and does not send the record to Deleted Records or start the recycle retention period. Use Canceled Jobs to view, filter, export or delete these records.</>],
        ['Resume a canceled job', <>In Canceled Jobs, choose <strong>Send to Active</strong> and save. This keeps the same record and Count. If its number matches another Active or Hold job, review the duplicate warning. Restore any required vendor, job type or paper masters first if requested. Counters resume, excluding the canceled period. Canceled and completed cards must return to Active before details, history or another status can be changed.</>],
        ['Move a batch to its next stage', <Steps><li>Find the card in <strong>Active Jobs</strong>.</li><li>Choose its new <strong>Current Vendor</strong> and <strong>Current Job</strong>.</li><li>Review the pair together, then click <strong>Save Changes</strong>.</li><li>Open Vendor History to check the saved sequence.</li></Steps>],
        ['What a progress change saves', <>Saving a changed vendor/job pair adds one new stage with the save time. The previous stages stay in the history. Choosing the already-current pair does not add another stage. Several unsaved dropdown changes result in the final chosen pair being saved, not a separate stage for every click.</>],
        ['Example: returning to a vendor', <>A card might move through <strong>Sarthak Creations — Printing → ABC Finishers — Lamination → Sarthak Creations — Cutting</strong>. All three stages belong to one card. The final stage tells you where the work is now.</>],
        ['View history or correct a mistake', <>Use <strong>Vendor History</strong> to read previous stages. For an Active card, turn on <strong>Editable</strong> to access <strong>Edit Sequence</strong>. You can correct a vendor/job pair, add or remove a stage, move stages up or down, and correct times. Keep at least one stage. Use this for a historical correction; use the Current Vendor/Current Job controls for normal forward progress.</>],
        ['Sequence order decides current work', <>The <strong>last stage in the saved list</strong> is the current stage, even if another stage has a later timestamp. Moving a stage can therefore change the current vendor. Existing times stay unchanged unless edited. New stages receive the save time unless you supply a time. Review both order and dates before saving.</>],
        ['Complete a job', <>In Active Jobs, choose <strong>Mark Completed</strong> from the Status dropdown and save. The card moves to <strong>Completed Jobs</strong> and its duration counters stop at completion. If you changed the vendor/job pair in the same row, review that too: saving can record the final stage and completion together.</>],
        ['Resume a completed job', <>In Completed Jobs, choose <strong>Send to Active</strong> and save. A duplicate active number may require confirmation. A master needed by the card, including one used in an earlier stage, must be restored first if it was deleted. Completed cards do not allow ordinary field or sequence corrections until they are returned to Active.</>],
        ['Understanding the day counters', <>Module 2 counts <strong>whole elapsed 24-hour periods</strong>. Total Days starts from Date of Entry; the Days column counts from the final stage’s time. Periods spent completed are excluded after reopening. For example, 36 hours of active time shows 1 day, not 2. These are not working-day or shift-hour calculations. Incorrect future dates can produce negative values; check the dates and stage order.</>],
        ['Save, Discard and conflicts', <>Changing a field is not the same as saving. <strong>Save Changes</strong> applies pending changes; <strong>Discard</strong> abandons them. Changes to one Job Card row save together. Saving several rows can still succeed for some and fail for others, so read the result. If another employee changed a record, refresh it and review their changes before trying again.</>],
      ],
    },
    {
      id: 'imports', title: '7. Excel / CSV Imports — Prepare the File Correctly',
      intro: 'Imports add master records. They do not import Orders or Job Cards and they do not update existing records with matching names.',
      rows: [
        ['Where Import Excel is available', <>Module 1: <strong>Client List, Product Lists and Product Types</strong>. Module 2: <strong>Vendors and Paper Types</strong>. Executive List and Job Types do not currently have an Excel import button. Open the exact master you want to add records to.</>],
        ['File layout', <>Use <strong>.xlsx, .xls or .csv</strong>. Put column headings in the first row and one record on each following row. Only the <strong>first worksheet</strong> is read. Do not place a title or notes above the headings. Header capitalisation does not matter and columns may be reordered, but use the exact heading words shown below, without extra spaces.</>],
        ['Module 1 — Client List headings', <><code>client name</code>, <code>contact person</code>, <code>phone number</code>. All three headings must be present. Client name needs a value; the contact cells may be blank. Example: ABC Packaging / Rahul Shah / 9876543210.</>],
        ['Module 1 — Product Lists headings', <><code>product list</code>, <code>client name</code>. Both headings must be present. Product List needs a value. A supplied client name must match an existing client; a blank client name creates an unlinked product. Import clients first when you want linked products. Duplicate checks consider the product name together with its client.</>],
        ['Module 1 — Product Types heading', <><code>product type</code>. Enter one non-empty product type per row, for example Carton.</>],
        ['Module 2 — Vendors headings', <><code>Vendor Name</code>, <code>Address</code>, <code>Concerned Person(s)</code>, <code>Concerned Person Contact(s)</code>, <code>Job Capabilities</code>. Keep all five headings even if some cells are blank. Only Vendor Name needs a value. Separate multiple capabilities with semicolons, for example <strong>Printing; Lamination</strong>. Each capability must match an active Job Type.</>],
        ['Module 2 — Paper Types heading', <><code>Paper Type Name</code>. Enter one non-empty name per row, such as Art Paper. Do not add separate GSM or size columns expecting them to be stored as additional fields.</>],
        ['Phone numbers and multiple contacts', <>Format phone cells as <strong>Text in Excel before entering numbers</strong>, especially numbers beginning with zero or +91. Once Excel has removed a leading zero, the importer cannot know what it was. For vendors, use semicolons between multiple people and contacts, in matching order: “Rahul; Priya” and “9876543210; 9123456780”.</>],
        ['Optional cell does not mean optional heading', <>You may leave Address or Contact cells empty where allowed, but the matching column heading must still exist. “Missing required columns” means the file’s headings need fixing, even when those fields do not require values.</>],
      ],
    },
    {
      id: 'import-results', title: '8. Import Preview, Warnings and Results',
      rows: [
        ['Import step by step', <Steps><li>Click <strong>Import Excel</strong> on the correct master page.</li><li>Choose your file and check the headings.</li><li>Review the preview: it shows the first 50 rows and the total number found.</li><li>Click <strong>Import Valid Records</strong>. The server then checks names and references; a preview alone does not mean every row is valid.</li><li>Read the completion summary and open Accepted Records or Skipped/Rejected for details.</li></Steps>],
        ['A missing client or capability warning', <>For Product Lists, an unknown client triggers a warning. For Vendors, an unknown or deleted Job Type in Job Capabilities triggers one. Cancel to correct the file or create/restore the missing master. If you choose <strong>Yes, Import Valid Records</strong>, affected rows are skipped. A vendor row is skipped entirely if any listed capability is unavailable; it is not imported with some capabilities silently removed.</>],
        ['Duplicates are skipped, not overwritten', <>Names are checked without treating upper- and lower-case letters as different. Repeated names within the file can also be skipped. Module 2 additionally checks names in its Recycle Bin. To change an existing record, edit it on the master page; re-importing its name is not an update operation.</>],
        ['Accepted versus Skipped/Rejected', <>Accepted records were added. Skipped/Rejected records were not added and have a reason, such as a missing name, duplicate name, missing client or unavailable capability. For example, 18 accepted and 2 rejected means fix those 2 rows; it does not mean the entire file failed.</>],
        ['Large files or interrupted imports', <>Records are processed in smaller groups, but large uploads can still take time or fail because of a connection or server problem. Wait for the result and avoid clicking repeatedly. If the page closes or an error appears, check the master list before retrying: some rows may already have been saved. Use smaller files if repeated attempts fail.</>],
      ],
    },
    {
      id: 'finding-records', title: '9. Find Records, Use Filters and Save Quick Views',
      rows: [
        ['Search, filters and pages', <>A record can be hidden by search text, filters, the current page or the wrong work list. Clear those restrictions before creating a replacement. Check Completed Orders/Jobs, Canceled Jobs and the correct module’s Deleted Records too. Rows per page changes how many records are shown at once; it does not change the total stored.</>],
        ['Using a filter', <>Choose the field, the comparison and the value. For example, <strong>Current Vendor → equals → ABC Print</strong> shows jobs currently with that vendor. Choose “contains” when you only know part of a text value. Date and quantity fields offer different comparisons from names.</>],
        ['AND and OR in plain language', <><strong>AND</strong> narrows the result: Vendor is ABC <strong>AND</strong> Paper Type is Art Paper requires both. <strong>OR</strong> offers alternatives: Vendor is ABC <strong>OR</strong> Vendor is XYZ includes either. In a mixed set, AND conditions form groups separated by OR. Keep the rules simple and inspect the results before applying a bulk action.</>],
        ['Quick Views', <>A Quick View saves a set of filter rules for reuse, such as “Work at ABC Print”. It does not copy or freeze the records. Opening it later shows the records that match then. Saved views are shared, so use a meaningful name. Module 1 orders and Module 2 jobs keep their own view contexts.</>],
        ['Sorting and column visibility', <>Click a sortable column heading to change the order shown. Use column controls to show or hide information where available. Hiding a column does not erase its values. Scroll sideways on wide tables to reach fields or action buttons off-screen.</>],
      ],
    },
    {
      id: 'bulk-and-exports', title: '10. Select Multiple Records, Export and Print',
      rows: [
        ['Selecting records', <>Tick row checkboxes to select records. Where supported, Shift-click selects a range. Watch the <strong>selected count</strong> before acting. Selection scope differs by page: tracking tables select loaded rows, while Deleted Records can select all records in the current category, including records on other pages. Clear the selection when finished.</>],
        ['Bulk actions', <>Use the floating action bar to act on selected records. Deleted Records limits a bulk action to <strong>200 records</strong>; if more are selected, deselect some before proceeding. Read confirmation messages and any partial-success report. A failed row does not necessarily cancel successful changes to other rows.</>],
        ['CSV, PDF and Print', <>On order/job tracking pages, these actions use the displayed page, or selected rows from that page. They are not automatically an export of every record matching all pages. Check the page size, filters and selection before exporting. CSV opens in Excel; PDF and Print are useful for sharing a readable list.</>],
        ['Save before exporting', <>Save your edits first so the report represents saved work. Check the exported rows and dates before sharing. An exported file is a separate copy: later changes in the system do not update a file you already downloaded.</>],
        ['“Export Full Database” has a limited scope', <>The current Settings export collects Module 1 order/client/product data. It does <strong>not include Module 2 Job Cards, stages or vendor masters</strong>. Do not use it as your only backup of both modules. Ask the administrator for a complete database backup when that is what you need.</>],
      ],
    },
    {
      id: 'deletion', title: '11. Delete, Restore and Permanently Remove Records',
      intro: 'Completing work and deleting work are different actions. Complete work when it is finished. Delete a record when it should leave the normal working list and go to the Recycle Bin.',
      rows: [
        ['Delete from a working list', <>Deleting an Order, Job Card or supported master normally moves it to that module’s Deleted Records page. It is not a permanent delete at that point. In Module 2, deleting a Job Card keeps its entire stage history with it so it can be restored.</>],
        ['Find the right category', <>Module 1 has <strong>Clients, Product Lists, Product Types and Orders</strong> tabs. Module 2 has <strong>Vendors, Job Types, Paper Types and Job Cards</strong> tabs. Switch tabs to see each category’s own table. Module 2 master-page Deleted Records buttons open the corresponding central tab.</>],
        ['Restore a record', <Steps><li>Open the correct module’s Deleted Records page.</li><li>Choose the category and find the record.</li><li>Click <strong>Restore</strong> and confirm, or select records and use <strong>Restore Selected</strong>.</li><li>Return to the working list and check the restored details.</li></Steps>],
        ['Restore linked masters first', <>An Order may need its client, product and product type restored first. Restore the client before its linked product, then the order. An Active Job Card needs its paper type and every vendor/job type used in its stages available. Restore those masters before restoring the card. A restored Job Card keeps its previous status, including Hold, Completed or Canceled; restoring a closed card does not restart work.</>],
        ['Why deletion can be blocked', <>A master may still be linked to work. Module 1 blocks removal of referenced clients/products and assigned executives. In Module 2, a vendor or job type used anywhere in a non-deleted Active or Hold Job’s history, or a paper used by an Active or Hold Job, cannot be deleted. Check the linked work; do not delete genuine history simply to clear a warning.</>],
        ['Name conflicts differ between modules', <>In Module 1, a replacement active record can conflict with restoring an older deleted record of the same name. Review which record should be kept before renaming anything. In Module 2, deleted master names remain reserved until permanent deletion, so restore the existing master rather than creating another with the same name.</>],
        ['Delete inside Deleted Records', <>The row’s <strong>Delete</strong> button here means <strong>permanent deletion</strong>. Read the Delete Forever confirmation carefully. Permanently deleting a Job Card also removes its stages and completion/reopening history, but does not delete its vendor, job type or paper masters. A permanently deleted record cannot be restored from this page.</>],
        ['“Protected: in use” in Module 2', <>This means a master still has references that must be preserved, even if the retention countdown has expired. Vendor history can protect a vendor; Job Cards protect their paper types; stages or vendor capabilities can protect a Job Type. The protection also applies to completed and deleted cards that still exist. Review those references before attempting permanent deletion.</>],
      ],
    },
    {
      id: 'retention', title: '12. Retention and Automatic Cleanup',
      rows: [
        ['How long deleted records are kept', <>The setting is <strong>Settings → Recycle Bin Retention (Days)</strong>. The configured value shown here is <strong>{retention} days</strong> (10 is the default when no value is available). It counts from deletion, not the original entry date. Restore records you need before they become eligible for permanent cleanup.</>],
        ['Module 2’s hourly cleanup', <>The database checks expired Module 2 records once an hour. It removes eligible deleted Job Cards first, followed by expired, unreferenced vendors, Job Types and Paper Types. Referenced masters stay protected. “Purging today” means eligible for cleanup, not that the record is guaranteed to remain until midnight.</>],
        ['Changing retention affects existing deleted records', <>Reducing retention can make older deleted records eligible at the next cleanup. Increasing retention cannot bring back anything already purged. Review the bin before changing the setting. A Recycle Bin is a temporary recovery area, not permanent storage.</>],
        ['Module 1 retention display', <>Module 1 also has a retention countdown and its existing database cleanup process. Some older page wording may still say “10 days”. Use Settings to check the configured value; if actual cleanup timing does not match it, ask the administrator to check the Module 1 cleanup setup. Module 2’s hourly schedule does not replace Module 1’s separate routine.</>],
      ],
    },
    {
      id: 'settings-and-safety', title: '13. Dates, Display Settings and Working with Other People',
      rows: [
        ['Date formats', <>Read dates in tables as <strong>day/month/year</strong>, for example 05/10/2026 means 5 October. Native date-entry controls may look different depending on your browser. Module 2’s stage times and date filters use <strong>India Standard Time</strong>. Check the month and year when typing or pasting dates.</>],
        ['Quantities', <>Quantities may display with Indian digit grouping: <strong>1,00,000</strong> means one lakh. Enter the actual whole-number quantity; separators are for readability. Recheck pasted values rather than assuming the system will fix an incorrect number. Module 2 does not accept zero, negative or fractional batch quantities.</>],
        ['Table density, theme and page size', <>Settings offers Comfortable or Compact rows and a default page size. Comfortable gives more room; Compact fits more rows on screen. Use the sidebar’s light/dark toggle for appearance. These display choices do not change business records. Individual pages may have their own Rows per page selection.</>],
        ['Order statuses versus job stages', <>Custom status names and colours in Settings apply to Module 1 orders. Module 2 keeps <strong>Active / Hold / Completed / Canceled</strong> as its statuses; Printing, Lamination and similar work belong in <strong>Job Types</strong>. Do not create an order status expecting it to become a vendor job stage.</>],
        ['When another employee changes data', <>Module 1 order screens can show a refresh banner when changes are detected. Module 2 Active Jobs refreshes periodically when you are not editing, and its Deleted Records page also refreshes periodically. Not every page updates instantly. Save or note your pending work before refreshing.</>],
        ['“This record changed”', <>Module 2 prevents an older screen from silently overwriting a newer saved version. Note the change you intended, refresh the record, compare the latest values and make the correction again if still needed. Do not keep clicking Save on the same outdated screen.</>],
      ],
    },
    {
      id: 'logs', title: '14. Activity Logs and History',
      rows: [
        ['What gets recorded', <>The system records supported actions such as creation, edits, deletion and restoration in its activity logs. Entries can identify the person, time, action and changed record. Module 2’s automatic purge entries identify the actor as <strong>System</strong>. Ask the administrator to review logs when investigating an unexpected change.</>],
        ['Old and new values', <>Edit entries can include values before and after a change. This helps distinguish “quantity changed” from “a new record was created”. Logs explain actions; they are not an Undo button and do not guarantee recovery of a permanently deleted record.</>],
        ['Three different kinds of history', <>Module 1’s <strong>In-Charge (History)</strong> shows executive assignments. Module 2’s <strong>Vendor History</strong> shows stages in the batch’s route. Activity logs describe actions performed in the system. Use the history that answers your question; they are not interchangeable.</>],
        ['Logs also have a retention setting', <>Log Retention in Settings is separate from Recycle Bin Retention. Do not assume activity logs are kept forever or that changing one setting changes the other. Request a suitable backup or export if information must be kept longer.</>],
      ],
    },
    {
      id: 'troubleshooting', title: '15. Common Questions — What Should I Do Next?',
      rows: [
        ['“I cannot find my record.”', <>Check the module, clear search/filter rules, and check other pages. Then check Completed, Canceled Jobs and Deleted Records. If you just made edits, check whether you clicked Save Changes. Do not create a replacement until you have checked these places.</>],
        ['“I deleted Sarthak Creations and cannot add it again.”', <>Go to <strong>Vendor Job Tracking → Deleted Records → Vendors</strong> and restore Sarthak Creations. Its name is reserved while deleted. Restoration keeps the original record and history; you can edit its details afterwards.</>],
        ['“My import says a column is missing.”', <>Check the exact headings in Section 7, including punctuation in Concerned Person(s). Keep headers in the first row of the first worksheet. Include every listed heading even when its values are optional. Remove extra spaces from headings and upload the corrected file.</>],
        ['“My imported vendor was skipped.”', <>Open Skipped/Rejected and read its reason. Check for an existing or deleted vendor with the same name and check every semicolon-separated Job Capability against active Job Types. Correct only the rejected rows, or edit/restore the existing vendor as appropriate.</>],
        ['“The Save or Import button is unavailable.”', <>Wait for loading or saving to finish. Complete required fields. Save or discard existing master edits and close the Add form before importing. In Deleted Records, reduce a selection above 200 before using bulk actions.</>],
        ['“The wrong vendor appears as current.”', <>Open Vendor History and check the final stage. Sequence position determines current work. For an Active card, use Editable → Edit Sequence to correct a historical mistake, or change Current Vendor/Current Job and save if work is genuinely moving now.</>],
        ['“A completed record needs work again.”', <>For an Order, choose the appropriate non-completed status and save. For a Job Card, choose Send to Active and save; restore deleted masters first if requested. Reopening a card resumes duration counting while excluding the completed interval.</>],
        ['“I see a setup, sign-in or connection error.”', <>For sign-in errors, sign in again. For a connection error, check whether the last action saved before retrying. A Module 2 setup message naming a SQL file needs the administrator’s attention; share the exact message rather than repeatedly creating records. Never share your password when asking for help.</>],
      ],
    },
  ];

  return (
    <div className="masters-page" id="help-top">
      <div style={{ marginBottom: 32, maxWidth: 1000 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>System Help Desk & Documentation</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 800, lineHeight: 1.7 }}>A practical guide to customer orders and vendor jobs. Start with the module you use, then follow the steps for entering work, saving changes, importing lists and recovering deleted records. The rules below explain what the system does and what you need to check.</p>
        <nav aria-label="Help contents" style={{ marginTop: 24, padding: 20, border: '1px solid var(--border)', borderRadius: 6, backgroundColor: 'var(--bg-surface)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Jump to a topic</h3>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9, margin: 0 }}>
            {sections.map(section => <li key={section.id}><a href={`#${section.id}`} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{section.title.replace(/^\d+\. /, '')}</a></li>)}
          </ol>
        </nav>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1000 }}>
        {sections.map(section => <Section key={section.id} {...section} />)}
      </div>
    </div>
  );
}
