import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import html2pdf from 'html2pdf.js';

// Copy the exact ThermalBillHTML function here
const ThermalBillHTML = ({ salesData, billNo, customerName, mobile, globalLoanAmount = 0, billSize = '3inch' }) => {
    const formatNumber = (num) => {
        if (typeof num !== 'number' && typeof num !== 'string') return '0';
        const number = parseFloat(num);
        if (isNaN(number)) return '0';

        if (Number.isInteger(number)) {
            return number.toLocaleString('en-US');
        } else {
            const parts = number.toFixed(2).split('.');
            const wholePart = parseInt(parts[0]).toLocaleString('en-US');
            return `${wholePart}.${parts[1]}`;
        }
    };

    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    const groupedById = new Map();
    salesData.forEach(s => {
        const id = s.id;
        if (!groupedById.has(id)) {
            groupedById.set(id, {
                ...s,
                weight: parseFloat(s.weight) || 0,
                price_per_kg: parseFloat(s.price_per_kg) || 0,
                packs: parseInt(s.packs) || 0,
                CustomerPackCost: parseFloat(s.CustomerPackCost) || 0,
                Kuliya: parseFloat(s.Kuliya) || 0
            });
        } else {
            const existing = groupedById.get(id);
            existing.weight += parseFloat(s.weight) || 0;
            existing.packs += parseInt(s.packs) || 0;
            existing.Kuliya += parseFloat(s.Kuliya) || 0;
        }
    });

    const uniqueSalesData = Array.from(groupedById.values());

    let totalSales = 0;
    let totalPackCost = 0;
    let totalKuliyaSum = 0;
    const consolidatedSummary = {};

    uniqueSalesData.forEach(s => {
        const itemName = s.item_name || 'Unknown';
        const weight = s.weight;
        const price = s.price_per_kg;
        const packs = s.packs;
        const packCost = s.CustomerPackCost;
        const kuliya = s.Kuliya;

        if (!consolidatedSummary[itemName]) consolidatedSummary[itemName] = { totalWeight: 0, totalPacks: 0 };
        consolidatedSummary[itemName].totalWeight += weight;
        consolidatedSummary[itemName].totalPacks += packs;

        totalSales += (weight * price);
        totalPackCost += (packs * packCost);
        totalKuliyaSum += kuliya;
    });

    const totalPacksSum = Object.values(consolidatedSummary).reduce((sum, item) => sum + item.totalPacks, 0);
    const finalGrandTotal = totalSales + totalPackCost + totalKuliyaSum;

    const receiptMaxWidth = '280px';

    const itemsHtml = uniqueSalesData.map(s => {
        const weight = s.weight;
        const price = s.price_per_kg;
        const value = (weight * price).toFixed(2);

        return `
        <tr style="font-size:16px; font-weight: bold; color: #000;">
            <td style="text-align:left; padding:8px 0;">
                ${s.item_name || ""}<br>${formatNumber(s.packs)}
            </td>
            <td style="text-align:right; padding:8px 2px;">
                ${formatNumber(weight.toFixed(2))}
            </td>
            <td style="text-align:right; padding:8px 2px;">
                ${formatNumber(price.toFixed(2))}
            </td>
            <td style="text-align:right; padding:8px 0;">
                <div style="font-size:20px;">${s.supplier_code || "ASW"}</div>
                <div>${formatNumber(value)}</div>
            </td>
        <tr>`;
    }).join("");

    const summaryEntries = Object.entries(consolidatedSummary);
    let summaryHtmlContent = '';
    for (let i = 0; i < summaryEntries.length; i += 2) {
        const [n1, d1] = summaryEntries[i];
        const [n2, d2] = summaryEntries[i + 1] || [null, null];
        summaryHtmlContent += `
        <tr>
            <td style="padding:4px; font-weight:bold;">${n1}:${formatNumber(d1.totalWeight)}/${d1.totalPacks}</td>
            <td style="padding:4px; font-weight:bold;">${d2 ? `${n2}:${formatNumber(d2.totalWeight)}/${d2.totalPacks}` : ''}</td>
        </tr>`;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; background: white; }
            .receipt-main { width: ${receiptMaxWidth}; margin: 0 auto; padding: 5px; }
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { width: 80mm; }
            }
            .header { text-align: center; }
            .badge { border: 2px solid #000; padding: 4px 8px; font-size: 18px; font-weight: bold; }
            .info-section { font-size: 16px; margin-top: 10px; }
            hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            .total-table { margin-top: 15px; font-weight: bold; font-size: 20px; }
        </style>
    </head>
    <body>
        <div class="receipt-main">
            <div class="header">
                <div style="font-size: 22px; font-weight: bold;">මහතුන් වෙළඳසැල</div>
                <div style="margin: 10px 0;">
                    <span class="badge">F2-1</span>
                    <span class="badge">${customerName.toUpperCase()}</span>
                </div>
                <div style="font-size: 14px; font-weight: bold;">විශේෂ ආර්ථික මධ්‍යස්ථානය දඹුල්ල</div>
            </div>

            <div class="info-section">
                <div style="font-weight: bold; font-size: 14px;">Tel: 0777672838 / 0714371115</div>
                <div style="display:flex; justify-content:space-between; font-size: 13px; margin-top: 5px;">
                    <span>බිල් අංකය: ${billNo}</span>
                    <div style="text-align:right;">
                        <span style="white-space:nowrap;">දිනය: ${date}</span><br>
                        <span>${time}</span>
                    </div>
                </div>
            </div>

            <hr />

            <table>
                <colgroup>
                    <col style="width:30%;">
                    <col style="width:20%;">
                    <col style="width:20%;">
                    <col style="width:30%;">
                </colgroup>
                <thead>
                    <tr style="border-bottom:2px solid #000; font-weight:bold; font-size:14px;">
                        <th style="text-align:left;">වර්ගය<br>මලු</th>
                        <th style="text-align:right;">කිලෝ</th>
                        <th style="text-align:right;">මිල</th>
                        <th style="text-align:right;">අගය</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="border-top:2px solid #000;">
                        <td colspan="4" style="padding-top:10px;">
                            <div style="display:flex; justify-content:space-between; font-size:24px; font-weight:bold;">
                                <span>${formatNumber(totalPacksSum)}</span>
                                <span>${Number(totalSales).toFixed(2)}</span>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>

            <table class="total-table">
                ${totalPackCost > 0 ? `<tr><td style="padding-top:5px;">මලු:</td><td style="text-align:right;">${formatNumber(totalPackCost.toFixed(2))}</td></tr>` : ''}
                ${totalKuliyaSum > 0 ? `<tr><td style="padding-top:5px;">කුලිය:</td><td style="text-align:right;">${formatNumber(totalKuliyaSum.toFixed(2))}</td></tr>` : ''}
                <tr>
                    <td style="padding-top:10px;">එකතුව:</td>
                    <td style="text-align:right; padding-top:10px;">
                        <span style="border-bottom:4px double #000; border-top:1px solid #000; font-size:26px;">
                            ${Number(finalGrandTotal).toFixed(2)}
                        </span>
                    </td>
                </tr>
                ${globalLoanAmount !== 0 ? `
                <tr>
                    <td style="font-size:18px; padding-top:10px;">පෙර ණය:</td>
                    <td style="text-align:right; font-size:20px; padding-top:10px;">
                        Rs. ${formatNumber(Math.abs(globalLoanAmount).toFixed(2))}
                    </td>
                </tr>` : ''}
            </table>

            <div style="margin-top:20px; border-top:1px dashed #000; padding-top:10px;">
                <table style="font-size:12px;">
                    <tbody>${summaryHtmlContent}</tbody>
                </table>
            </div>
        </div>
    </body>
    </html>`;
};

const PublicBill = () => {
    const { token } = useParams();
    const [billData, setBillData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`https://goviraju.lk/DBS_backend_30500/api/public/bill/${token}`)
            .then(res => {
                setBillData(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Bill fetch error:", err);
                setLoading(false);
            });
    }, [token]);

    const handleDownload = () => {
        const element = document.getElementById('bill-content');
        const opt = {
            margin: [10, 5, 10, 5],
            filename: `Bill_${billData.bill_no}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    if (loading) return <div className="p-10 text-center text-xl">Loading Bill...</div>;
    if (!billData) return <div className="p-10 text-center text-red-500">Bill Not Found.</div>;

    const salesArray = typeof billData.sales_data === 'string'
        ? JSON.parse(billData.sales_data)
        : billData.sales_data;

    return (
        <div className="bg-gray-200 min-h-screen p-4 flex flex-col items-center">
            <button 
                onClick={handleDownload}
                className="mb-6 text-white px-12 py-4 rounded-full font-black shadow-2xl uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 border-b-4 border-red-900"
                style={{ 
                    backgroundColor: '#dc2626',
                    display: 'block',
                    margin: '0 auto 24px auto' 
                }}
            >
                Download PDF (බාගත කරන්න)
            </button>

            <div id="bill-content" className="bg-white shadow-2xl p-2 rounded-sm">
                <div dangerouslySetInnerHTML={{
                    __html: ThermalBillHTML({
                        salesData: salesArray,
                        billNo: billData.bill_no,
                        customerName: billData.customer_name,
                        mobile: billData.customer_mobile || "0777672838 / 0714371115",
                        globalLoanAmount: billData.loan_amount || 0,
                        billSize: '3inch'
                    })
                }} />
            </div>
        </div>
    );
};

export default PublicBill;