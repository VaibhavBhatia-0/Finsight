// Savings and goals share the canonical savings_goals resource.
export {
  useGoals as useSavings,
  useCreateGoal as useCreateSavings,
  useUpdateGoal as useUpdateSavings,
  useDeleteGoal as useDeleteSavings,
} from './useGoals';
export type { Goal as SavingsGoal } from './useGoals';
