import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/types'
import TaskItem from './TaskItem'
import DropIndicator from './DropIndicator'

interface DraggableTaskItemProps {
  task: Task
  onToggleComplete: (taskId: string, completed: boolean) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  isOverlay?: boolean
}

export default function DraggableTaskItem({ task, onToggleComplete, onEdit, onDelete, isOverlay }: DraggableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <DropIndicator isActive={isOver} />
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes}
        className={`${isDragging ? 'opacity-50' : ''}`}
      >
        <TaskItem
          task={task}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          isDragging={isDragging}
          dragHandleProps={listeners}
        />
      </div>
    </>
  )
}
