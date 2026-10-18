import { FamilyWorkspace } from "../dashboard/FamilyWorkspace";

export default function ApprovalLayout({ children }: { children: React.ReactNode }) {
  return <FamilyWorkspace section="Review details">{children}</FamilyWorkspace>;
}
