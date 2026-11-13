"use client";

import { HaddirDialog } from "../../../components/ui/HaddirDialog";

export type AccountDialog = "logout" | "delete-email" | "delete-final" | null;

type AccountDialogsProps = {
  accountDialog: AccountDialog;
  deleteEmailInput: string;
  setDeleteEmailInput: (value: string) => void;
  deletingAccount: boolean;
  onConfirmSignOut: () => void | Promise<void>;
  onContinueDelete: () => void;
  onExecuteDelete: () => void | Promise<void>;
  onClose: () => void;
};

export function AccountDialogs({
  accountDialog,
  deleteEmailInput,
  setDeleteEmailInput,
  deletingAccount,
  onConfirmSignOut,
  onContinueDelete,
  onExecuteDelete,
  onClose,
}: AccountDialogsProps) {
  return (
    <>
      {accountDialog === "logout" && (
        <HaddirDialog
          open
          title="تسجيل الخروج؟"
          description="هل تريد تسجيل الخروج من حسابك؟ ستعود إلى شاشة تسجيل الدخول."
          confirmLabel="تسجيل الخروج"
          tone="primary"
          onConfirm={onConfirmSignOut}
          onCancel={onClose}
        />
      )}

      {accountDialog === "delete-email" && (
        <HaddirDialog
          open
          title="تأكيد هوية الحساب"
          description="اكتب البريد الإلكتروني المرتبط بحسابك للمتابعة في طلب حذف الحساب."
          confirmLabel="متابعة"
          onConfirm={onContinueDelete}
          onCancel={onClose}
        >
          <input
            className="haddir-dialog-input"
            type="email"
            value={deleteEmailInput}
            onChange={(event) => setDeleteEmailInput(event.target.value)}
            placeholder="البريد الإلكتروني"
            autoComplete="email"
          />
        </HaddirDialog>
      )}

      {accountDialog === "delete-final" && (
        <HaddirDialog
          open
          title="حذف الحساب نهائياً؟"
          description="سيتم حذف الحساب وإيصالات التحويل والبيانات الشخصية. ستبقى سجلات المعاملات اللازمة محفوظة بعد إزالة بيانات تعريفك. لن يسمح النظام بالحذف إذا كانت لديك تذكرة مؤكدة لفعالية قادمة."
          confirmLabel="حذف الحساب نهائياً"
          tone="danger"
          busy={deletingAccount}
          onConfirm={onExecuteDelete}
          onCancel={onClose}
        />
      )}
    </>
  );
}
