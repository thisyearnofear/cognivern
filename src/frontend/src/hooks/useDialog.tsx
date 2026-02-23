import { useState, useCallback } from "react";

export type DialogType = "confirm" | "prompt" | "alert" | "multifield";

interface DialogState {
  isOpen: boolean;
  type: DialogType | null;
  title: string;
  message: string;
  variant?: "info" | "warning" | "success" | "error";
  onConfirm?: (value?: any) => void;
  onCancel?: () => void;
  fields?: any[];
  placeholder?: string;
  inputType?: string;
  defaultValue?: string;
}

/**
 * Custom hook for managing dialogs
 *
 * Provides a simple API to show alert, confirm, prompt, and multi-field dialogs
 * without using native browser dialogs.
 *
 * @example
 * const { showAlert, showConfirm, showPrompt, DialogComponent } = useDialog();
 *
 * // Show an alert
 * showAlert("Success!", "Your changes have been saved.", "success");
 *
 * // Show a confirmation
 * const confirmed = await showConfirm("Delete Item", "Are you sure?", "warning");
 * if (confirmed) {
 *   // delete item
 * }
 *
 * // Show a prompt
 * const name = await showPrompt("Enter Name", "What's your name?");
 * if (name) {
 *   // use name
 * }
 */
export const useDialog = () => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    type: null,
    title: "",
    message: "",
    variant: "info",
  });

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    // Clear state after animation
    setTimeout(() => {
      setDialogState({
        isOpen: false,
        type: null,
        title: "",
        message: "",
        variant: "info",
      });
    }, 300);
  }, []);

  /**
   * Show an alert dialog (info only, single OK button)
   */
  const showAlert = useCallback(
    (
      title: string,
      message: string,
      variant: "info" | "warning" | "success" | "error" = "info",
    ): Promise<void> => {
      return new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          type: "alert",
          title,
          message,
          variant,
          onConfirm: () => {
            closeDialog();
            resolve();
          },
        });
      });
    },
    [closeDialog],
  );

  /**
   * Show a confirmation dialog (Yes/No)
   */
  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      variant: "info" | "warning" | "error" = "info",
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          type: "confirm",
          title,
          message,
          variant,
          onConfirm: () => {
            closeDialog();
            resolve(true);
          },
          onCancel: () => {
            closeDialog();
            resolve(false);
          },
        });
      });
    },
    [closeDialog],
  );

  /**
   * Show a prompt dialog (input field)
   */
  const showPrompt = useCallback(
    (
      title: string,
      message: string,
      placeholder?: string,
      defaultValue?: string,
      inputType: "text" | "number" | "email" | "password" = "text",
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          type: "prompt",
          title,
          message,
          placeholder,
          defaultValue,
          inputType,
          onConfirm: (value: string) => {
            closeDialog();
            resolve(value);
          },
          onCancel: () => {
            closeDialog();
            resolve(null);
          },
        });
      });
    },
    [closeDialog],
  );

  /**
   * Show a multi-field dialog
   */
  const showMultiField = useCallback(
    (
      title: string,
      message: string,
      fields: any[],
    ): Promise<Record<string, string> | null> => {
      return new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          type: "multifield",
          title,
          message,
          fields,
          onConfirm: (values: Record<string, string>) => {
            closeDialog();
            resolve(values);
          },
          onCancel: () => {
            closeDialog();
            resolve(null);
          },
        });
      });
    },
    [closeDialog],
  );

  return {
    dialogState,
    closeDialog,
    showAlert,
    showConfirm,
    showPrompt,
    showMultiField,
  };
};

export default useDialog;
