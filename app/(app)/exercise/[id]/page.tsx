import { ExerciseHistoryClient } from './exercise-history-client'

interface PageProps {
  params: { id: string }
}

export default function ExercisePage({ params }: PageProps) {
  return <ExerciseHistoryClient exerciseId={params.id} />
}
