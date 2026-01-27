# Dialog System

This application uses a custom dialog system that replaces native browser dialogs (`alert()`, `prompt()`, `confirm()`) with beautiful, branded UI components that match the rest of the application.

## Components

### 1. Dialog (Base Component)
The foundation component for all dialogs. Provides a modal with customizable title, description, actions, and variants.

```tsx
import { Dialog } from "@/components/ui/Dialog";

<Dialog
  isOpen={isOpen}
  onClose={handleClose}
  title="Dialog Title"
  description="Optional description text"
  variant="info" // info | warning | success | error
  primaryAction={{
    label: "Confirm",
    onClick: handleConfirm,
    variant: "primary",
    isLoading: false
  }}
  secondaryAction={{
    label: "Cancel",
    onClick: handleCancel
  }}
>
  {/* Optional custom content */}
</Dialog>
```

### 2. ConfirmDialog
A simple confirmation dialog with Yes/No or OK/Cancel buttons.

```tsx
import { ConfirmDialog } from "@/components/ui/Dialog";

<ConfirmDialog
  isOpen={isOpen}
  onClose={handleClose}
  onConfirm={handleConfirm}
  title="Confirm Action"
  message="Are you sure you want to proceed?"
  confirmText="Yes, Continue"
  cancelText="Cancel"
  variant="warning" // info | warning | error
  isLoading={isSubmitting}
/>
```

### 3. PromptDialog
A dialog with a single input field for collecting user input.

```tsx
import { PromptDialog } from "@/components/ui/Dialog";

<PromptDialog
  isOpen={isOpen}
  onClose={handleClose}
  onSubmit={handleSubmit}
  title="Enter Value"
  message="Please provide the information below:"
  placeholder="Enter text here..."
  defaultValue=""
  inputType="text" // text | number | email | password
  validation={(value) => {
    if (!value) return "This field is required";
    return null;
  }}
  isLoading={isSubmitting}
/>
```

### 4. MultiFieldDialog
A dialog with multiple input fields for collecting complex data.

```tsx
import { MultiFieldDialog } from "@/components/ui/Dialog";

<MultiFieldDialog
  isOpen={isOpen}
  onClose={handleClose}
  onSubmit={handleSubmit}
  title="Submit Form"
  message="Please fill out all required fields:"
  fields={[
    {
      name: "email",
      label: "Email Address",
      type: "email",
      placeholder: "you@example.com",
      required: true,
      validation: (value) => {
        if (!value.includes("@")) return "Invalid email";
        return null;
      }
    },
    {
      name: "message",
      label: "Message",
      type: "textarea",
      placeholder: "Enter your message...",
      required: false
    }
  ]}
  submitText="Submit"
  isLoading={isSubmitting}
/>
```

## Usage Hook

For simpler use cases, use the `useDialog` hook which provides a Promise-based API:

```tsx
import { useDialog } from "@/hooks/useDialog";

function MyComponent() {
  const { showAlert, showConfirm, showPrompt, showMultiField } = useDialog();

  const handleDelete = async () => {
    const confirmed = await showConfirm(
      "Delete Item",
      "Are you sure you want to delete this item? This action cannot be undone.",
      "warning"
    );

    if (confirmed) {
      // Proceed with deletion
      await deleteItem();
      await showAlert("Success", "Item deleted successfully", "success");
    }
  };

  const handleRename = async () => {
    const newName = await showPrompt(
      "Rename Item",
      "Enter a new name:",
      "New name",
      currentName
    );

    if (newName) {
      // Update name
      await updateName(newName);
    }
  };

  const handleCreateUser = async () => {
    const values = await showMultiField(
      "Create User",
      "Enter user details:",
      [
        {
          name: "username",
          label: "Username",
          type: "text",
          required: true
        },
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true
        }
      ]
    );

    if (values) {
      await createUser(values.username, values.email);
    }
  };

  return (
    <div>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={handleRename}>Rename</button>
      <button onClick={handleCreateUser}>Create User</button>
    </div>
  );
}
```

## Migration from Native Dialogs

### Before (Native)
```tsx
// Alert
alert("Success!");

// Confirm
if (confirm("Are you sure?")) {
  // Do something
}

// Prompt
const name = prompt("Enter your name:");
if (name) {
  // Use name
}
```

### After (Custom Dialogs)

#### Using Direct Components
```tsx
const [showSuccess, setShowSuccess] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
const [showPrompt, setShowPrompt] = useState(false);

// Alert
<ConfirmDialog
  isOpen={showSuccess}
  onClose={() => setShowSuccess(false)}
  onConfirm={() => setShowSuccess(false)}
  title="Success"
  message="Operation completed successfully!"
  variant="info"
  confirmText="OK"
/>

// Confirm
<ConfirmDialog
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleConfirm}
  title="Confirm"
  message="Are you sure?"
  variant="warning"
/>

// Prompt
<PromptDialog
  isOpen={showPrompt}
  onClose={() => setShowPrompt(false)}
  onSubmit={handleNameSubmit}
  title="Enter Name"
  message="What's your name?"
/>
```

#### Using Hook (Recommended)
```tsx
const { showAlert, showConfirm, showPrompt } = useDialog();

// Alert
await showAlert("Success", "Operation completed!", "success");

// Confirm
const confirmed = await showConfirm("Confirm", "Are you sure?", "warning");
if (confirmed) {
  // Do something
}

// Prompt
const name = await showPrompt("Enter Name", "What's your name?");
if (name) {
  // Use name
}
```

## Styling

All dialogs inherit the design system tokens and maintain consistency with:
- Primary/secondary color scheme
- Elevation and shadows
- Border radius
- Typography scale
- Spacing system

### Variants

Dialogs support visual variants that change the accent color:

- **info** (default): Blue accent, for general information
- **success**: Green accent, for successful operations
- **warning**: Orange/yellow accent, for cautionary messages
- **error**: Red accent, for errors and destructive actions

## Accessibility

All dialog components are built with accessibility in mind:

- Keyboard navigation (Tab, Shift+Tab)
- Focus trapping within dialog
- ESC key to close
- ARIA labels and roles
- Focus restoration after close
- Screen reader support

## Best Practices

1. **Use appropriate variants**: Match the dialog variant to the action severity
2. **Clear messaging**: Use concise, action-oriented titles and messages
3. **Validation**: Always validate user input in form dialogs
4. **Loading states**: Show loading states during async operations
5. **Cancel actions**: Always provide a way to cancel/close dialogs
6. **Avoid nesting**: Don't open dialogs from within dialogs
7. **Test on mobile**: Ensure dialogs work well on smaller screens

## Examples in the Codebase

See `src/frontend/src/components/sapience/SapienceMarkets.tsx` for a real-world example of using `MultiFieldDialog` and `ConfirmDialog` for forecast submissions.
