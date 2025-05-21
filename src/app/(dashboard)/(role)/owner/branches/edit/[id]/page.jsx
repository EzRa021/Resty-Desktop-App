import EditBranchClientPage from "./EditBranchClientPage"

// Add this export at the top of the file, before the component definition
export function generateStaticParams() {
  // This tells Next.js which paths to pre-render at build time
  // For dynamic routes with static export
  return [{ id: "placeholder" }]
}

export default function EditBranchPage({ params }) {
  return <EditBranchClientPage params={params} />
}
