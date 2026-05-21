import { WorkoutLogClient } from './workout-log-client'

interface PageProps {
  params: { date: string }
}

export default function WorkoutPage({ params }: PageProps) {
  return <WorkoutLogClient date={params.date} />
}
