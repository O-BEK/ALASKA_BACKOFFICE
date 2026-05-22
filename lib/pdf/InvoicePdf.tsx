import "server-only"
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import type { Invoice, InvoiceLine } from "@/lib/types"
import type { InvoiceTotals } from "@/lib/invoice-calculations"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 64, height: 64 },
  companyBlock: { textAlign: "right" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  invoiceTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    paddingBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: "6 8",
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ebebeb",
  },
  col1: { flex: 5 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 2, textAlign: "right" },
  col4: { flex: 2, textAlign: "right" },
  totalsSection: { marginTop: 16, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
    gap: 24,
  },
  totalLabel: { width: 72, textAlign: "right" },
  totalValue: { width: 88, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    gap: 24,
  },
  grandTotalLabel: { width: 72, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  grandTotalValue: { width: 88, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  notes: { marginTop: 20, fontSize: 9, color: "#555555" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888888",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    paddingTop: 6,
  },
  muted: { color: "#666666" },
})

function fmtMad(n: number): string {
  return (
    n.toLocaleString("fr-MA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " MAD"
  )
}

interface CompanyInfo {
  name: string
  address: string
  rc: string
  ice: string
}

interface InvoicePdfProps {
  invoice: Invoice & { lines: InvoiceLine[] }
  totals: InvoiceTotals
  logoBase64?: string
  company: CompanyInfo
}

export function InvoicePdf({ invoice, totals, logoBase64, company }: InvoicePdfProps) {
  const sortedLines = [...invoice.lines].sort((a, b) => a.line_order - b.line_order)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header : logo à gauche, infos émetteur à droite */}
        <View style={styles.header}>
          <View>
            {logoBase64 ? (
              <Image src={logoBase64} style={styles.logo} />
            ) : null}
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.muted}>{company.address}</Text> : null}
            {company.rc ? <Text style={styles.muted}>RC : {company.rc}</Text> : null}
            {company.ice ? <Text style={styles.muted}>ICE : {company.ice}</Text> : null}
          </View>
        </View>

        {/* Titre + numéro + date */}
        <Text style={styles.invoiceTitle}>FACTURE</Text>
        <View style={styles.metaRow}>
          <Text>N° {invoice.invoice_number}</Text>
          <Text style={styles.muted}>Date : {invoice.invoice_date}</Text>
        </View>

        {/* Bloc client */}
        <Text style={styles.sectionTitle}>Facturé à</Text>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{invoice.client_name}</Text>
        {invoice.client_rc ? <Text style={styles.muted}>RC : {invoice.client_rc}</Text> : null}
        {invoice.client_address ? <Text style={styles.muted}>{invoice.client_address}</Text> : null}

        {/* Tableau des prestations */}
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Désignation</Text>
          <Text style={styles.col2}>Qté</Text>
          <Text style={styles.col3}>PU HT (MAD)</Text>
          <Text style={styles.col4}>Total HT (MAD)</Text>
        </View>
        {sortedLines.map((line, i) => (
          <View key={line.id || String(i)} style={styles.tableRow}>
            <Text style={styles.col1}>{line.description}</Text>
            <Text style={styles.col2}>{line.quantity}</Text>
            <Text style={styles.col3}>{fmtMad(line.unit_price_ht)}</Text>
            <Text style={styles.col4}>{fmtMad(line.quantity * line.unit_price_ht)}</Text>
          </View>
        ))}

        {/* Récapitulatif */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmtMad(totals.total_ht)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA 10%</Text>
            <Text style={styles.totalValue}>{fmtMad(totals.tva_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total TTC</Text>
            <Text style={styles.grandTotalValue}>{fmtMad(totals.total_ttc)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Pied de page légal */}
        <Text style={styles.footer}>
          Facture soumise à la TVA au taux de 10% — Paiement à réception de la facture sauf accord préalable écrit
        </Text>
      </Page>
    </Document>
  )
}
