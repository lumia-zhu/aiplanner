import { DragOverlay as DndKitDragOverlay } from '@dnd-kit/core'
import type { Task } from '@/types'
import TaskItem from './TaskItem'

interface DragOverlayProps {
  activeTask: Task | null
}

export default function DragOverlay({ activeTask }: DragOverlayProps) {
  return (
    <DndKitDragOverlay dropAnimation={null}>
      {activeTask ? (
        <div className="transform rotate-3 opacity-90">
          <TaskItem
            task={activeTask}
            onToggleComplete={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            isDragging={true}
          />
        </div>
      ) : null}
    </DndKitDragOverlay>
  )
}
