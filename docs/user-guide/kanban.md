# Kanban Boards

Kairo includes a powerful kanban board feature for visual task management, fully integrated with your notes.

## Getting Started

### Opening Kanban View

- Press `Ctrl+Shift+K` to toggle the kanban view
- Or use the Command Palette (`Ctrl+K`) and search for "Kanban"

### Creating a Board

1. Open the kanban view
2. Click "New Board" or use the + button
3. Enter a name for your board
4. Optionally customize the default columns

### Default Columns

New boards come with these columns:
- **Backlog** - Tasks not yet started
- **In Progress** - Active work
- **Done** - Completed tasks (marks cards as closed)

---

## Working with Cards

### Creating Cards

1. Click the "+ Add Card" button at the bottom of any column
2. Enter a title
3. Optionally add:
   - Description (supports markdown)
   - Due date
   - Priority (Low, Medium, High, Urgent)

### Card Templates

Use templates for consistent card structure:

1. When creating a card, select a template
2. Built-in templates include:
   - **Task** - Simple task with description
   - **Bug** - Bug report with reproduction steps
   - **Feature** - Feature request with user stories
   - **Meeting** - Meeting notes with agenda/attendees

### Moving Cards

Drag and drop cards between columns or within a column to reorder.

### Card Details

Click any card to open the detail panel:
- View/edit description
- See creation and update timestamps
- View linked notes (backlinks)
- Change priority and due date

---

## Linking Notes to Cards

### From Notes to Cards

Reference a kanban card from any note:

```markdown
The implementation details are tracked in [[card:ProjectX/Implement feature]].
```

### From Cards to Notes

Cards can be linked to a note:
1. Open the card detail panel
2. Set the "Linked Note" field
3. The card will show a link to the associated note

### Viewing Backlinks on Cards

When a card is referenced in notes using `[[card:...]]` syntax, those references appear in the card's backlinks section.

---

## Board Management

### Renaming Boards

1. Open board settings (gear icon)
2. Edit the board name
3. Save changes

### Adding/Removing Columns

1. Click the column header menu
2. Add new columns with custom names and colors
3. Mark columns as "Done" columns (closes cards automatically)

### Deleting Boards

1. Open board settings
2. Click "Delete Board"
3. Confirm the deletion (this is permanent)

---

## Side Pane Integration

View card details without leaving your notes:

1. Create a card link in your note: `[[card:BoardName/CardTitle]]`
2. Right-click the link
3. Select "Open in Side Pane"
4. View and reference card details while keeping your note visible

### Resizing the Side Pane

Drag the divider between the main content and side pane.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` | Toggle Kanban View |
| `Escape` | Close card detail / Exit kanban view |
| `Enter` (on card) | Open card detail |

---

## Tips & Best Practices

### Organizing Work

- Create separate boards for different projects or contexts
- Use priority levels consistently
- Set due dates for time-sensitive items

### Integration with Notes

- Reference cards from daily notes for task tracking
- Create a project note that links to all related cards
- Use card descriptions for detailed requirements, link to notes for discussions

### Card Naming

- Use descriptive, action-oriented titles
- Include context in the title: "Feature: Dark Mode" vs just "Dark Mode"
- Keep titles unique within a board for reliable linking
