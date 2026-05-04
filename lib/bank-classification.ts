import type {
  BankExpenseCategory,
  BankTransaction,
  BankTransactionClassification,
  BankTransactionReviewStatus,
} from "@/lib/bank-parsers/types"

export interface BankTransactionRule {
  id?: string
  match_text: string
  classification: BankTransactionClassification
  expense_category: BankExpenseCategory | null
  matched_label: string
  is_active?: boolean
}

export interface ClassifiedBankTransaction extends BankTransaction {
  classification: BankTransactionClassification
  expense_category: BankExpenseCategory | null
  matched_label: string | null
  review_status: BankTransactionReviewStatus
  notes: string | null
}

export const BANK_CLASSIFICATION_LABELS: Record<BankTransactionClassification, string> = {
  supplier_payment: "Fournisseur",
  fixed_charge: "Charge fixe",
  staff_payment: "RH / salaire",
  cash_deposit: "Dépôt cash",
  owner_injection: "Apport à vérifier",
  external_income: "Revenu hors POS",
  bank_fee: "Frais bancaires",
  ignore: "Ignorer",
  uncategorized: "À classer",
}

export const DEFAULT_BANK_TRANSACTION_RULES: BankTransactionRule[] = [
  {
    match_text: "salaire",
    classification: "staff_payment",
    expense_category: "RH",
    matched_label: "Salaire",
  },
  {
    match_text: "wafasalaf",
    classification: "fixed_charge",
    expense_category: "CHARGES",
    matched_label: "Crédit moto Wafasalaf",
  },
  {
    match_text: "esther biton",
    classification: "fixed_charge",
    expense_category: "CHARGES",
    matched_label: "Loyer",
  },
  {
    match_text: "frais",
    classification: "bank_fee",
    expense_category: "CHARGES",
    matched_label: "Frais bancaires",
  },
  {
    match_text: "mohamed othman bekri",
    classification: "owner_injection",
    expense_category: null,
    matched_label: "Apport propriétaire",
  },
  {
    match_text: "othman bekri",
    classification: "owner_injection",
    expense_category: null,
    matched_label: "Apport propriétaire",
  },
  {
    match_text: "bekri",
    classification: "owner_injection",
    expense_category: null,
    matched_label: "Apport propriétaire",
  },
  {
    match_text: "kayzaran",
    classification: "cash_deposit",
    expense_category: null,
    matched_label: "Transfert interne BP Kayzaran",
  },
]

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function statusFor(classification: BankTransactionClassification): BankTransactionReviewStatus {
  return classification === "ignore" ? "ignored" : "suggested"
}

export function classifyBankTransaction(
  transaction: BankTransaction,
  rules: BankTransactionRule[] = []
): ClassifiedBankTransaction {
  const label = normalize(transaction.label)
  const activeRules = [
    ...rules.filter((rule) => rule.is_active !== false && rule.match_text.trim()),
    ...DEFAULT_BANK_TRANSACTION_RULES,
  ]
  const matchedRule = activeRules.find((rule) => label.includes(normalize(rule.match_text)))

  if (matchedRule) {
    return {
      ...transaction,
      classification: matchedRule.classification,
      expense_category: matchedRule.expense_category,
      matched_label: matchedRule.matched_label,
      review_status: statusFor(matchedRule.classification),
      notes: transaction.notes ?? null,
    }
  }

  let classification: BankTransactionClassification = "uncategorized"
  let expense_category: BankExpenseCategory | null = null
  let matched_label: string | null = null

  if (transaction.credit > 0) {
    if (
      label.includes("virement banque") ||
      label.includes("versement") ||
      label.includes("remise especes") ||
      label.includes("depot espece") ||
      label.includes("depot cash")
    ) {
      classification = "cash_deposit"
      matched_label = "Dépôt cash"
    } else {
      classification = "owner_injection"
      matched_label = "Apport à vérifier"
    }
  } else if (transaction.debit > 0) {
    if (label.includes("frais") || label.includes("commission") || label.includes("agios")) {
      classification = "bank_fee"
      expense_category = "CHARGES"
      matched_label = "Frais bancaires"
    } else if (label.includes("salaire") || label.includes("paie") || label.includes("rh")) {
      classification = "staff_payment"
      expense_category = "RH"
      matched_label = "RH"
    } else if (label.includes("loyer") || label.includes("eau") || label.includes("electricite") || label.includes("telecom")) {
      classification = "fixed_charge"
      expense_category = "CHARGES"
      matched_label = "Charge fixe"
    } else if (label.includes("fournisseur") || label.includes("virement emis") || label.includes("vir fournisseur")) {
      classification = "supplier_payment"
      expense_category = "AUTRE"
      matched_label = "Fournisseur"
    }
  }

  return {
    ...transaction,
    classification,
    expense_category,
    matched_label,
    review_status: statusFor(classification),
    notes: transaction.notes ?? null,
  }
}

export function isBankExpenseClassification(classification: BankTransactionClassification) {
  return ["supplier_payment", "fixed_charge", "staff_payment", "bank_fee"].includes(classification)
}
