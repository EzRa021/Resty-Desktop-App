export function EmptyState({ icon: Icon, title, description, action }) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="mt-6 text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    )
  }
  