"use client";

import { useEffect, useMemo, useRef } from "react";
import { DataspaceEditForm } from "@/app/dataspace/[id]/DataspaceEditForm";
import { DataspaceNotificationPreferences } from "@/app/dataspace/[id]/DataspaceNotificationPreferences";

type Props = {
  dataspaceId: string;
  canEdit: boolean;
  isSubscribed: boolean;
  initialName: string;
  initialDescription: string | null;
  initialColor: string | null;
  initialImageUrl: string | null;
  initialNotifyAllActivity: boolean;
  initialNotifyMeetings: boolean;
  initialNotifyPlans: boolean;
  initialNotifyTexts: boolean;
  initialRssEnabled: boolean;
  initialTelegramGroupChatId: string | null;
  initialTelegramGroupLinkCode: string | null;
  subscriptionNotifyAll: boolean;
  subscriptionNotifyMeetings: boolean;
  subscriptionNotifyPlans: boolean;
  subscriptionNotifyTexts: boolean;
};

export function DataspaceSettingsModal({
  dataspaceId,
  canEdit,
  isSubscribed,
  initialName,
  initialDescription,
  initialColor,
  initialImageUrl,
  initialNotifyAllActivity,
  initialNotifyMeetings,
  initialNotifyPlans,
  initialNotifyTexts,
  initialRssEnabled,
  initialTelegramGroupChatId,
  initialTelegramGroupLinkCode,
  subscriptionNotifyAll,
  subscriptionNotifyMeetings,
  subscriptionNotifyPlans,
  subscriptionNotifyTexts
}: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const buttonLabel = useMemo(
    () => (canEdit ? "Edit dataspace" : "Settings"),
    [canEdit]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#settings") {
      dialogRef.current?.showModal();
    }
  }, []);

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="w-[min(96vw,1100px)] max-w-none rounded-none border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Dataspace settings</p>
            <p className="text-sm text-slate-700">Manage notifications, RSS, and profile details.</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(90vh-72px)] space-y-6 overflow-y-auto px-6 py-6">
          {canEdit ? (
            <DataspaceEditForm
              dataspaceId={dataspaceId}
              initialName={initialName}
              initialDescription={initialDescription}
              initialColor={initialColor}
              initialImageUrl={initialImageUrl}
              initialNotifyAllActivity={initialNotifyAllActivity}
              initialNotifyMeetings={initialNotifyMeetings}
              initialNotifyPlans={initialNotifyPlans}
              initialNotifyTexts={initialNotifyTexts}
              initialRssEnabled={initialRssEnabled}
              initialTelegramGroupChatId={initialTelegramGroupChatId}
              initialTelegramGroupLinkCode={initialTelegramGroupLinkCode}
            />
          ) : null}
          <DataspaceNotificationPreferences
            dataspaceId={dataspaceId}
            isSubscribed={isSubscribed}
            initialNotifyAll={subscriptionNotifyAll}
            initialNotifyMeetings={subscriptionNotifyMeetings}
            initialNotifyPlans={subscriptionNotifyPlans}
            initialNotifyTexts={subscriptionNotifyTexts}
          />
        </div>
      </dialog>
    </>
  );
}
