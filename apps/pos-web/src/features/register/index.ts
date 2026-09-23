export { OpenRegisterForm, type OpenRegisterFormProps, type OpenRegisterSubmit, type RegisterChoice, type DeviceChoice } from "./OpenRegisterForm";
export { CloseShiftForm } from "./CloseShiftForm";
export { RegisterScreen } from "./RegisterScreen";
export { createRegisterController, type RegisterController, type RegisterWorkspacePorts } from "./registerController";
export { parseDecimalToMinorUnits, type DecimalParseResult } from "./parseDecimalToMinorUnits";
export {
  describeShiftStatus,
  formatSignedMoneyDisplay,
  idleShiftWorkspace,
  shouldAnnounceRegisterOpened,
  type ShiftStatusView,
  type ShiftWorkspaceView,
} from "./shiftView";

export const REGISTER_STYLESHEETS = ["@/features/register/register.css"] as const;
