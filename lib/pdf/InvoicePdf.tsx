import "server-only"
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import type { Invoice, InvoiceLine } from "@/lib/types"
import type { InvoiceTotals } from "@/lib/invoice-calculations"

const ACCENT = "#5C6B3A"
const ACCENT_LIGHT = "#F1F4EB"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    paddingBottom: 80,
    color: "#1a1a1a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 100, objectFit: "contain" },
  companyBlock: { textAlign: "right" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  invoiceTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6, color: ACCENT },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
    paddingBottom: 3,
    color: ACCENT,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: ACCENT,
    padding: "6 8",
    marginTop: 12,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ebebeb",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ebebeb",
    backgroundColor: ACCENT_LIGHT,
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
    borderTopWidth: 1.5,
    borderTopColor: ACCENT,
    gap: 24,
  },
  grandTotalLabel: { width: 72, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12, color: ACCENT },
  grandTotalValue: { width: 88, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12, color: ACCENT },
  notes: { marginTop: 20, fontSize: 9, color: "#555555" },
  bankingSection: {
    marginTop: 24,
    borderWidth: 0.75,
    borderColor: ACCENT,
    borderRadius: 2,
    padding: "8 10",
  },
  bankingTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  bankingRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 3,
  },
  bankingItem: { flex: 1 },
  bankingItemWide: { flex: 2 },
  bankingLabel: { fontSize: 7, color: "#888888", marginBottom: 1 },
  bankingValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: ACCENT,
    paddingTop: 5,
  },
  footerLegal: {
    fontSize: 7.5,
    color: ACCENT,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 3,
  },
  footerNote: {
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
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
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt concept */}
            {logoBase64 ? <Image src={logoBase64} style={styles.logo} /> : null}
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.muted}>{company.address}</Text> : null}
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
        {invoice.client_rc ? <Text style={styles.muted}>ICE : {invoice.client_rc}</Text> : null}
        {invoice.client_address ? <Text style={styles.muted}>{invoice.client_address}</Text> : null}

        {/* Tableau des prestations */}
        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.tableHeaderText]}>Désignation</Text>
          <Text style={[styles.col2, styles.tableHeaderText]}>Qté</Text>
          <Text style={[styles.col3, styles.tableHeaderText]}>PU HT (MAD)</Text>
          <Text style={[styles.col4, styles.tableHeaderText]}>Total HT (MAD)</Text>
        </View>
        {sortedLines.map((line, i) => (
          <View key={line.id || String(i)} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
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

        {/* Coordonnées Bancaires */}
        <View style={styles.bankingSection}>
          <Text style={styles.bankingTitle}>Coordonnées Bancaires</Text>
          <View style={styles.bankingRow}>
            <View style={styles.bankingItem}>
              <Text style={styles.bankingLabel}>Banque</Text>
              <Text style={styles.bankingValue}>050</Text>
            </View>
            <View style={styles.bankingItem}>
              <Text style={styles.bankingLabel}>Ville</Text>
              <Text style={styles.bankingValue}>810</Text>
            </View>
            <View style={styles.bankingItemWide}>
              <Text style={styles.bankingLabel}>N° de compte</Text>
              <Text style={styles.bankingValue}>0060110872772001</Text>
            </View>
            <View style={styles.bankingItem}>
              <Text style={styles.bankingLabel}>Clé RIB</Text>
              <Text style={styles.bankingValue}>56</Text>
            </View>
          </View>
          <View style={styles.bankingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankingLabel}>IBAN</Text>
              <Text style={styles.bankingValue}>050810006011087277200156</Text>
            </View>
          </View>
        </View>

        {/* Pied de page : identifiants légaux + mention TVA */}
        <View style={styles.footer}>
          <Text style={styles.footerLegal}>
            N° I.C.E : 003315860000064  |  ID FISCALE : 53879443  |  Patente : 2019 | 2023 | 54788
          </Text>
          <Text style={styles.footerNote}>
            Facture soumise à la TVA au taux de 10% — Paiement à réception de la facture sauf accord préalable écrit
          </Text>
        </View>
      </Page>
    </Document>
  )
}
