// src/pages/TransactionForm.tsx
import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCreateExpense } from "../hooks/useExpenses";

type FormValues = {
  amount: number;
  category: string;
  date: string;
  description?: string;
};

const TransactionForm: React.FC = () => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();
  const { mutateAsync, isPending, error } = useCreateExpense();

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    await mutateAsync(data);
    reset();
  };

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Add Transaction</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Transaction form">
        <div>
          <label className="block mb-1" htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            className="w-full border rounded p-2"
            {...register("amount", { required: true })}
          />
          {errors.amount && <span className="text-red-600">Required</span>}
        </div>
        <div>
          <label className="block mb-1" htmlFor="category">Category</label>
          <input
            id="category"
            type="text"
            className="w-full border rounded p-2"
            {...register("category", { required: true })}
          />
          {errors.category && <span className="text-red-600">Required</span>}
        </div>
        <div>
          <label className="block mb-1" htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            className="w-full border rounded p-2"
            {...register("date", { required: true })}
          />
          {errors.date && <span className="text-red-600">Required</span>}
        </div>
        <div>
          <label className="block mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            className="w-full border rounded p-2"
            {...register("description")}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save Transaction"}
        </button>
        {error && <p className="text-red-600 mt-2" role="alert">Error saving transaction</p>}
      </form>
    </main>
  );
};

export default TransactionForm;
