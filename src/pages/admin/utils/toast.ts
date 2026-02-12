import { toast, type ToastOptions } from "react-toastify";

const baseOptions: ToastOptions = {
  position: "top-right",
  autoClose: 2000,
  pauseOnHover: true,
  closeOnClick: true,
  theme: "colored",
};

export const notifySuccess = (message: string) => toast.success(message, baseOptions);
export const notifyError = (message: string) => toast.error(message, baseOptions);
export const notifyInfo = (message: string) => toast.info(message, baseOptions);
export const notifyWarn = (message: string) => toast.warning(message, baseOptions);
