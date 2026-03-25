/**
 * lib/types.ts — Tipos compartidos de la plataforma
 */

export interface User {
  id: string
  email: string
  created_at: string
}

export interface Survey {
  id: string
  title: string
  description: string | null
  image_url: string | null
  question: string
  is_active: boolean
  close_at: string | null
  created_at: string
}

export interface Option {
  id: string
  survey_id: string
  text: string
  order: number
}

export interface Vote {
  id: string
  survey_id: string
  option_id: string
  ip_hash: string
  session_id: string
  created_at: string
}

export interface SurveyWithOptions extends Survey {
  options: Option[]
}

export interface OptionResult extends Option {
  count: number
  percentage: number
}

export interface SurveyResults {
  survey: Survey
  options: OptionResult[]
  total_votes: number
  last_vote_at: string | null
}

export interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export interface QueuedVote {
  surveyId: string
  optionId: string
  ipHash: string
  sessionId: string
  ts: number
}

export interface DashboardMetrics {
  total_votes: number
  votes_today: number
  active_surveys: number
  closed_surveys: number
}
