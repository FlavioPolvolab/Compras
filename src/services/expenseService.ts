import { supabase } from "@/lib/supabase";

export interface Expense {
  id?: string;
  user_id: string;
  name: string;
  description: string;
  amount: number;
  purpose: string;
  cost_center_id: string;
  category_id: string;
  payment_date: string;
  status: "pending" | "approved" | "rejected";
  payment_status?: "pending" | "paid";
  paid_at?: string;
  rejection_reason?: string;
  submitted_date?: string;
  updated_at?: string;
}

export interface Receipt {
  id?: string;
  expense_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at?: string;
}

export const fetchExpenses = async (filters: any = {}) => {
  try {
    let query = supabase.from("expenses").select(`
      *,
      users:user_id (name, email),
      cost_centers:cost_center_id (name),
      categories:category_id (name),
      receipts (*)
    `);

    // Aplicar filtros de forma mais segura
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      query = query.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
      );
    }

    if (filters.status && filters.status !== "") {
      query = query.eq("status", filters.status);
    }

    if (filters.category && filters.category !== "") {
      query = query.eq("category_id", filters.category);
    }

    if (filters.costCenter && filters.costCenter !== "") {
      query = query.eq("cost_center_id", filters.costCenter);
    }

    if (filters.dateRange?.from) {
      query = query.gte("submitted_date", filters.dateRange.from.toISOString());
    }

    if (filters.dateRange?.to) {
      query = query.lte("submitted_date", filters.dateRange.to.toISOString());
    }

    // Ordenar por data de envio, mais recentes primeiro
    query = query.order("submitted_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar despesas:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Erro ao processar busca de despesas:", error);
    throw error;
  }
};

export const fetchExpenseById = async (id: string) => {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      `
      *,
      users:user_id (name, email),
      cost_centers:cost_center_id (name),
      categories:category_id (name),
      receipts (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao buscar despesa:", error);
    throw error;
  }

  return data;
};

export const createExpense = async (expense: Expense, files: File[]) => {
  try {
    // Inserir despesa
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert([expense])
      .select()
      .single();

    if (expenseError) {
      console.error("Erro ao criar despesa:", expenseError);
      throw expenseError;
    }

    // Fazer upload de arquivos e criar registros de comprovantes
    if (files.length > 0 && expenseData) {
      const receipts = await Promise.all(
        files.map(async (file, i) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${expenseData.id}/${Date.now()}_${i}.${fileExt}`;
          const filePath = `${fileName}`;

          // Fazer upload do arquivo para o armazenamento
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Erro ao fazer upload do arquivo:", uploadError);
            throw uploadError;
          }

          // Criar registro de comprovante
          return {
            expense_id: expenseData.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
          };
        }),
      );

      // Inserir registros de comprovantes
      const { error: receiptsError } = await supabase
        .from("receipts")
        .insert(receipts);

      if (receiptsError) {
        console.error("Erro ao criar comprovantes:", receiptsError);
        throw receiptsError;
      }
    }

    return expenseData;
  } catch (error) {
    console.error("Erro ao processar despesa:", error);
    throw error;
  }
};

export const updateExpenseStatus = async (
  id: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
) => {
  try {
    const updateData: any = { status, updated_at: new Date().toISOString() };

    if (status === "rejected" && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Erro ao atualizar status da despesa:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Erro ao processar atualização de status:", error);
    throw error;
  }
};

export const updatePaymentStatus = async (id: string, isPaid: boolean) => {
  try {
    const updateData = {
      payment_status: isPaid ? "paid" : "pending",
      paid_at: isPaid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao atualizar status de pagamento:", error);
    throw error;
  }
};

export const getReceiptUrl = async (path: string) => {
  try {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 300); // URL válida por 5 minutos

    if (error) {
      console.error("Erro ao obter URL do comprovante:", error);
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao processar URL do comprovante:", error);
    throw error;
  }
};

export const fetchCategories = async () => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Erro ao buscar categorias:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Erro ao processar categorias:", error);
    return [];
  }
};

export const fetchCostCenters = async () => {
  try {
    const { data, error } = await supabase
      .from("cost_centers")
      .select("*")
      .order("name");

    if (error) {
      console.error("Erro ao buscar centros de custo:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Erro ao processar centros de custo:", error);
    return [];
  }
};

export const deleteExpense = async (id: string) => {
  try {
    // Deletar todos os receipts relacionados antes de deletar a expense
    const { error: receiptsError } = await supabase
      .from("receipts")
      .delete()
      .eq("expense_id", id);
    if (receiptsError) {
      console.error("Erro ao deletar comprovantes:", receiptsError);
      throw receiptsError;
    }
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Erro ao deletar despesa:", error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error("Erro ao processar exclusão da despesa:", error);
    throw error;
  }
};
