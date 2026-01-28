# ABA Harmony Scheduler - Features

## Drag and Drop Schedule Management

The scheduler now includes full drag and drop functionality for easy schedule management:

### How to Use Drag and Drop

1. **Moving Sessions**:
   - Click and hold on any schedule block (session)
   - Drag it to a new time slot or therapist column
   - Release to drop and update the schedule
   - The system automatically validates the move and shows any conflicts

2. **Visual Indicators**:
   - **Drag handle icon** (≡): Appears on hover - indicates the block is draggable
   - **Edit icon** (pencil): Click to edit session details
   - **Cursor changes**: Pointer becomes a "move" cursor when hovering over draggable blocks
   - **Drop zones**: Empty slots highlight with a blue background when you drag a block over them
   - **Opacity feedback**: Dragged blocks become semi-transparent during the drag operation

3. **Adding New Sessions**:
   - Click any empty time slot to add a new session
   - Alternatively, hover over empty slots to see the "+ Add" button

### Features

- **Real-time Validation**: Schedules are validated immediately after each move
- **Conflict Detection**: The system prevents double-booking and checks all constraints
- **Visual Feedback**: Color-coded session types (ABA, OT, SLP, Lunch/Indirect)
- **Legend Guide**: Interactive guide at the top shows instructions and session type colors
- **Team Organization**: Schedule is organized by teams with color-coded headers
- **Responsive Design**: Works on desktop and tablet devices

### Sample Data

The system comes pre-loaded with sample data:
- **3 Teams**: Red, Blue, and Green teams
- **6 Therapists**: Each with different qualifications and capabilities
- **6 Clients**: With various insurance requirements and allied health needs

To generate a schedule:
1. Select a date in the header
2. Click "Generate for [Date]" to run the CSO algorithm
3. The algorithm will create an optimized schedule
4. Use drag and drop to make manual adjustments as needed
5. Click "Evolve Current" to further optimize an existing schedule

### Advanced Features

- **Base Schedules**: Create reusable schedule templates for recurring patterns
- **Callouts**: Track therapist and client unavailability
- **Filters**: Filter the schedule by teams, therapists, or clients
- **Bulk Import**: Import clients and therapists via CSV files
- **Real-time Sync**: All changes are saved to Supabase and sync across sessions
