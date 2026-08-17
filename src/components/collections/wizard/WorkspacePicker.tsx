// WorkspacePicker.tsx — Workspace Wave 6.3.
//
// "When a user creates a collection, they must explicitly choose the
// workspace that the collection belongs to" (Wave 6 brief §5). Before this,
// the wizard silently read whatever workspace happened to be active, so a
// user who switched context mid-session could file a collection into a
// workspace they never intended.
//
// Only workspaces where the caller holds `collection:create` are offered —
// and that list comes from the SERVER's capabilities array, not from a
// client-side reading of `role`. Hiding the others is a convenience: the
// backend independently asserts the capability and returns 403/404, so this
// component is UX, never enforcement.
import React from "react";
import { Building2, Check } from "lucide-react";
import { useWorkspaceStore, type Workspace } from "@/store/useWorkspaceStore";
import { CAPABILITY, workspacesWithCapability } from "@/utils/workspaceCapabilities";

interface WorkspacePickerProps {
  value: string;
  onChange: (workspaceId: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  personal: "Personal",
  organization: "Organization",
  association: "Association",
  community: "Community",
  event: "Event",
  group: "Group",
};

export const WorkspacePicker: React.FC<WorkspacePickerProps> = ({ value, onChange }) => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const eligible = workspacesWithCapability(workspaces, CAPABILITY.COLLECTION_CREATE);

  // Nothing to choose between — don't make the user click through a
  // single-option step. The backend still resolves and authorizes the
  // workspace on submit.
  if (eligible.length <= 1) return null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Workspace</h3>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Choose which workspace this collection belongs to. You can only create in
        workspaces where you have permission.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {eligible.map((workspace: Workspace) => {
          const selected = workspace.id === value;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onChange(workspace.id)}
              aria-pressed={selected}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                selected
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {workspace.name}
                </span>
                <span className="block text-xs text-gray-500">
                  {TYPE_LABEL[workspace.type] || workspace.type}
                </span>
              </span>
              {selected && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkspacePicker;
