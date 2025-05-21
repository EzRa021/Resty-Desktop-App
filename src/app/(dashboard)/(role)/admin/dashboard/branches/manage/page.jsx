import { Metadata } from "next"
import { BranchManagement } from "@/components/branches/branch-management"

export const metadata = {
  title: "Branch Management",
  description: "Manage all your restaurant branches in one place",
}

export default function BranchManagementPage() {
  return <BranchManagement />
}
