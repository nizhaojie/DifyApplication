import { useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CommandEntry {
  id: string
  label: string
  group: string
  icon: LucideIcon
  /** extra filter keywords */
  keywords?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: CommandEntry[]
}

export function CommandPalette({ open, onOpenChange, entries }: CommandPaletteProps) {
  const groups = useMemo(() => {
    const map = new Map<string, CommandEntry[]>()
    for (const entry of entries) {
      const bucket = map.get(entry.group)
      if (bucket) bucket.push(entry)
      else map.set(entry.group, [entry])
    }
    return [...map.entries()]
  }, [entries])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay cmdk-overlay" />
        <Dialog.Content className="cmdk" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">命令面板</Dialog.Title>
          <Command label="命令面板" loop>
            <div className="cmdk-input">
              <Search size={16} />
              <Command.Input placeholder="搜索页面或操作…" autoFocus />
            </div>
            <Command.List className="cmdk-list">
              <Command.Empty className="cmdk-empty">没有匹配的结果</Command.Empty>
              {groups.map(([group, items]) => (
                <Command.Group key={group} heading={group}>
                  {items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.keywords ?? ''}`}
                      className="cmdk-item"
                      onSelect={() => {
                        onOpenChange(false)
                        item.run()
                      }}
                    >
                      <item.icon size={15} />
                      <span>{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
