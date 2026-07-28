package com.arynoxtech.erp.util

object NumberToWords {

    private val units = arrayOf(
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    )

    private val tens = arrayOf(
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    )

    fun convert(amount: Double): String {
        if (amount < 0) return "Negative Amount"
        if (amount == 0.0) return "Zero Rupees Only"

        val rupees = amount.toLong()
        val paise = ((amount - rupees) * 100).let { kotlin.math.round(it).toLong() }

        val rupeesPart = if (rupees > 0) "${convertRupees(rupees)} Rupees" else ""
        val paisePart = if (paise > 0) " and ${convertRupees(paise)} Paise" else ""
        val only = " Only"

        return "${rupeesPart}${paisePart}${only}".trimStart()
    }

    private fun convertRupees(n: Long): String {
        if (n == 0L) return ""

        val crore = n / 10_000_000
        val lakh = (n % 10_000_000) / 100_000
        val thousand = (n % 100_000) / 1000
        val hundred = (n % 1000) / 100
        val remainder = n % 100

        val parts = mutableListOf<String>()

        if (crore > 0) parts.add("${convertUnder1000(crore)} Crore")
        if (lakh > 0) parts.add("${convertUnder1000(lakh)} Lakh")
        if (thousand > 0) parts.add("${convertUnder1000(thousand)} Thousand")
        if (hundred > 0) parts.add("${convertUnder100(hundred)} Hundred")
        if (remainder > 0) parts.add(convertUnder100(remainder))

        return parts.joinToString(" ")
    }

    private fun convertUnder1000(n: Long): String {
        return when {
            n < 100 -> convertUnder100(n)
            n % 100 == 0L -> "${convertUnder100(n / 100)} Hundred"
            else -> "${convertUnder100(n / 100)} Hundred ${convertUnder100(n % 100)}"
        }
    }

    private fun convertUnder100(n: Long): String {
        return when {
            n < 20L -> units[n.toInt()]
            n % 10 == 0L -> tens[(n / 10).toInt()]
            else -> "${tens[(n / 10).toInt()]} ${units[(n % 10).toInt()]}"
        }
    }
}
