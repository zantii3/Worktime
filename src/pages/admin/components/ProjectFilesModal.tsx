import { AnimatePresence, motion } from "framer-motion";
import React from "react";

import { FileText, Trash2, Upload, X } from "lucide-react";

import type { Project, ProjectFile } from "../context/AdminTypes";
import { notifyError, notifySuccess } from "../utils/toast";

// 1 MB hard limit for uploaded files
const MAX_FILE_SIZE = 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
  projects: Project[];
  /**
   * Bug fix #8: was typed as `(projects: Project[]) => void` which doesn't
   * accept the updater-function overload.  Matching React.Dispatch exactly
   * lets callers pass either a new array or a function.
   */
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
};

function ProjectFilesModal({
  open,
  onClose,
  project,
  projects,
  setProjects,
}: Props) {
  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      notifyError("File exceeds 1 MB limit.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;

      const newFile: ProjectFile = {
        id: Date.now(),
        name: file.name,
        base64,
        uploadedBy: "Admin",
        uploadedAt: new Date().toISOString(),
        projectId: project.id,
      };

      /**
       * Bug fix #7: previously called saveProjects(updatedProjects) here as
       * well. AdminProvider already auto-persists to localStorage whenever
       * `projects` state changes (via its own useEffect), so calling
       * saveProjects directly was a redundant double-write that could
       * diverge from context state if the setter ever batches.
       * Relying solely on the context setter is the correct pattern.
       */
      setProjects((prev) =>
        prev.map((p) =>
          p.id !== project.id
            ? p
            : { ...p, files: [...(p.files ?? []), newFile] }
        )
      );

      notifySuccess("File uploaded successfully.");
    };

    reader.readAsDataURL(file);
  };

  const deleteFile = (fileId: number) => {
    // Same fix as above — no direct saveProjects call needed.
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== project.id
          ? p
          : { ...p, files: p.files.filter((f) => f.id !== fileId) }
      )
    );

    notifySuccess("File deleted.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-card w-full max-w-2xl rounded-2xl shadow-lg border border-slate-200 p-6 space-y-5"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-text-heading">
                  Project Files
                </div>
                <div className="text-xs text-text-primary/70 mt-0.5">
                  {project.name}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-soft transition"
                type="button"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-text-primary/70" />
              </button>
            </div>

            {/* Upload drop-zone */}
            <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:bg-soft transition">
              <Upload className="w-4 h-4 text-text-primary/70" />
              <span className="text-sm font-semibold text-text-primary/70">
                Upload File
              </span>
              <span className="text-xs text-text-primary/50">(max 1 MB)</span>
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  // Reset so the same file can be re-selected after removal
                  e.target.value = "";
                }}
              />
            </label>

            {/* File list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(project.files ?? []).length === 0 ? (
                <div className="text-sm text-text-primary/60 text-center py-6">
                  No files uploaded yet.
                </div>
              ) : (
                (project.files ?? []).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-text-primary/60 shrink-0" />
                      <span className="text-sm text-text-heading truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="text-rose-600 hover:text-rose-700 ml-3 shrink-0"
                      type="button"
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ProjectFilesModal;