"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { normalizeSudanesePhone, isValidSudanesePhone } from "../../../lib/utils/phone";
import { signInWithGoogle as startGoogleSignIn, updateCustomerProfile } from "../../auth/services/auth.service";
import type { AuthUser } from "../../auth/types";
import { requestCustomerAccountDeletion } from "../services/customer-account.service";
import type { AccountDialog } from "../components/AccountDialogs";

type UseCustomerAccountActionsOptions = {
  authUser: AuthUser | null;
  fullName: string;
  phone: string;
  deleteEmailInput: string;
  setFullName: (value: string) => void;
  setPhone: (value: string) => void;
  setProfileEditing: (value: boolean) => void;
  setSaved: (value: boolean) => void;
  setAuthMessage: (value: string) => void;
  setProfileSaving: (value: boolean) => void;
  setDeletingAccount: (value: boolean) => void;
  setAccountDialog: Dispatch<SetStateAction<AccountDialog>>;
  setDeleteEmailInput: (value: string) => void;
};

export function useCustomerAccountActions({
  authUser,
  fullName,
  phone,
  deleteEmailInput,
  setFullName,
  setPhone,
  setProfileEditing,
  setSaved,
  setAuthMessage,
  setProfileSaving,
  setDeletingAccount,
  setAccountDialog,
  setDeleteEmailInput,
}: UseCustomerAccountActionsOptions) {
  const signInWithGoogle = useCallback(async () => {
    const error = await startGoogleSignIn();
    if (error) setAuthMessage(error);
  }, [setAuthMessage]);

  const saveProfile = useCallback(async () => {
    if (!authUser) {
      setAuthMessage("سجّل الدخول أولاً لحفظ بياناتك.");
      return;
    }

    const cleanName = fullName.trim();
    const normalizedPhone = normalizeSudanesePhone(phone);
    if (cleanName.length < 2) {
      setAuthMessage("اكتب اسمك بصورة صحيحة.");
      return;
    }
    if (!isValidSudanesePhone(normalizedPhone)) {
      setAuthMessage("رقم الهاتف لازم يكون 10 خانات بالضبط ويبدأ بصفر، مثال: 09XXXXXXXX.");
      return;
    }

    setProfileSaving(true);
    setSaved(false);
    setAuthMessage("");
    const result = await updateCustomerProfile(authUser.id, cleanName, normalizedPhone);
    setProfileSaving(false);
    if (result.error) {
      setAuthMessage(result.error);
      return;
    }

    setFullName(result.fullName || cleanName);
    setPhone(result.phone || normalizedPhone);
    setProfileEditing(false);
    setSaved(true);
  }, [authUser, fullName, phone, setAuthMessage, setFullName, setPhone, setProfileEditing, setProfileSaving, setSaved]);

  const deleteAccount = useCallback(() => {
    if (!authUser?.email) {
      setAuthMessage("سجّل الدخول أولاً عشان تقدر تحذف حسابك.");
      return;
    }
    setDeleteEmailInput("");
    setAccountDialog("delete-email");
  }, [authUser?.email, setAccountDialog, setAuthMessage, setDeleteEmailInput]);

  const executeDeleteAccount = useCallback(async () => {
    const confirmedEmail = deleteEmailInput.trim();
    if (!authUser?.email) return;
    if (confirmedEmail.toLowerCase() !== authUser.email.toLowerCase()) {
      setAccountDialog(null);
      setAuthMessage("البريد الإلكتروني غير مطابق. لم يتم حذف أي بيانات.");
      return;
    }

    setAccountDialog(null);
    setDeletingAccount(true);
    setAuthMessage("");
    const deletion = await requestCustomerAccountDeletion(confirmedEmail);
    setDeletingAccount(false);
    if (deletion.error) {
      setAuthMessage(deletion.error);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.assign("/?tab=profile");
  }, [authUser?.email, deleteEmailInput, setAccountDialog, setAuthMessage, setDeletingAccount]);

  const signOut = useCallback(() => setAccountDialog("logout"), [setAccountDialog]);

  const confirmSignOut = useCallback(async () => {
    setAccountDialog(null);
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthMessage("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");
        return;
      }
    }
    setAuthMessage("تم تسجيل الخروج بنجاح. يمكنك تسجيل الدخول مرة أخرى في أي وقت.");
  }, [setAccountDialog, setAuthMessage]);

  return { signInWithGoogle, saveProfile, deleteAccount, executeDeleteAccount, signOut, confirmSignOut };
}
