"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Store } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useBranch } from "@/lib/hooks/useBranch"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar"

export function BranchSelector() {
  const [open, setOpen] = React.useState(false)
  const { branches, currentBranch, setCurrentBranch, isLoading } = useBranch()
  console.log(branches)

  const handleBranchChange = (branch) => {
    setCurrentBranch(branch)
    setOpen(false)
    toast.success(`Switched to ${branch.name}`)
  }

  if (branches.length <= 1) {
    return null
  }

  return (
    <SidebarGroup className="py-2">
      <SidebarGroupContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-sm">
              <div className="flex items-center gap-2 truncate">
                <Store className="size-4 shrink-0" />
                <span className="truncate">
                  {isLoading ? "Loading branches..." : currentBranch?.name || "Select branch"}
                </span>
              </div>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search branches..." />
              <CommandList>
                <CommandEmpty>No branches found.</CommandEmpty>
                <CommandGroup>
                  {branches.map((branch) => (
                    <CommandItem key={branch._id} value={branch.name} onSelect={() => handleBranchChange(branch)}>
                      <Check
                        className={cn("mr-2 size-4", currentBranch?._id === branch._id ? "opacity-100" : "opacity-0")}
                      />
                      {branch.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
