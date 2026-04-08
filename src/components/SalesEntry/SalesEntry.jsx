import React, { useState, useEffect, useMemo, useRef } from "react";
import Select from "react-select";
import Layout from "../Layout/Layout";
import '../../App.css';
import api from "../../api";
import AdminView from "../AdminView";
import { ThermalBillHTML, A4BillHTML } from '../BillTemplates';
import ImagePreviewModal from '../ImagePreviewModal';

const routes = {
    markPrinted: "/sales/mark-printed",
    getLoanAmount: "/get-loan-amount",
    markAllProcessed: "/sales/mark-all-processed",
    givenAmount: "/sales",
    sales: "/sales",
    customers: "/customers",
    items: "/items",
    suppliers: "/suppliers",
    getCustomerGivenAmount: "/sales/customer/given-amount",
    bulkUpdateCustomer: "/sales/bulk-update-customer"
};

// --- Sub-Components  ---
const BreakdownDisplay = ({ sale, formatDecimal }) => {
    if (!sale?.breakdown_history) return null;
    let history = [];
    try {
        history = typeof sale.breakdown_history === 'string' ? JSON.parse(sale.breakdown_history) : sale.breakdown_history;
    } catch (e) { return null; }
    if (!Array.isArray(history) || history.length < 2) return null;

    return (
        <div className="mt-4 p-3 bg-white rounded-lg border-2 border-blue-500 shadow-sm" style={{ width: '450px', margin: '10px auto' }}>
            <div style={{ maxHeight: '150px' }}>
                <table className="w-full text-xs text-black" style={{ marginTop: "-6px" }}>
                    <thead>
                        <tr className="text-gray-500 border-b">
                            <th className="text-left py-1">(වේලාව)</th>
                            <th className="text-right py-1">(බර)</th>
                            <th className="text-right py-1">(මලු)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((entry, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                                <td className="py-1 text-white">{entry.time}</td>
                                <td className="py-1 text-right font-bold text-white">{formatDecimal(entry.weight)} kg</td>
                                <td className="py-1 text-right font-bold text-white">{entry.packs}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 pt-1 border-t-2 border-blue-200 text-right font-black text-sm text-black">
                Total: {formatDecimal(sale.weight)}kg / {sale.packs}p
            </div>
        </div>
    );
};

//customer list section
const CustomerList = React.memo(({ customers, type, searchQuery, onSearchChange, selectedPrintedCustomer, selectedUnprintedCustomer, handleCustomerClick, formatDecimal, allSales, lastUpdate, isCashFilterActive, toggleCashFilter }) => {
    const getPrintedCustomerGroups = () => {
        const groups = {};
        allSales.filter(s => s.bill_printed === 'Y' && s.bill_no).forEach(sale => {

            // --- UPDATED FILTER LOGIC ---
            if (type === "printed") {
                if (isCashFilterActive) {
                    // When ticked: show only 'N' (Cash)
                    if (sale.credit_transaction !== 'Y') return;
                } else {
                    // When unticked (Default): show only 'Y' (Credit)
                    if (sale.credit_transaction !== 'N') return;
                }
            }

            const groupKey = `${sale.customer_code}-${sale.bill_no}`;
            if (!groups[groupKey]) groups[groupKey] = {
                customerCode: sale.customer_code,
                billNo: sale.bill_no,
                displayText: sale.customer_code
            };
        });
        return groups;
    };
    const getUnprintedCustomers = () => {
        const customerMap = {};
        allSales.filter(s => s.bill_printed === 'N').forEach(sale => {
            const customerCode = sale.customer_code;
            const saleTimestamp = new Date(sale.timestamp || sale.created_at || sale.date || sale.id);
            if (!customerMap[customerCode] || saleTimestamp > new Date(customerMap[customerCode].latestTimestamp)) {
                customerMap[customerCode] = { customerCode, latestTimestamp: sale.timestamp || sale.created_at || sale.date || sale.id, originalItem: customerCode };
            }
        });
        return customerMap;
    };

    const printedCustomerGroups = type === "printed" ? getPrintedCustomerGroups() : {};
    const unprintedCustomerMap = type === "unprinted" ? getUnprintedCustomers() : {};

    const filteredPrintedGroups = useMemo(() => {
        if (type !== "printed") return [];
        let groupsArray = Object.values(printedCustomerGroups);
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            groupsArray = groupsArray.filter(g => g.customerCode.toLowerCase().startsWith(lowerQuery) || g.billNo.toString().toLowerCase().startsWith(lowerQuery) || g.displayText.toLowerCase().startsWith(lowerQuery));
        }
        return groupsArray.sort((a, b) => (parseInt(b.billNo) || 0) - (parseInt(a.billNo) || 0));
    }, [printedCustomerGroups, searchQuery, type]);

    const filteredUnprintedCustomers = useMemo(() => {
        if (type !== "unprinted") return [];
        let customersArray = Object.values(unprintedCustomerMap);
        if (searchQuery) customersArray = customersArray.filter(c => c.customerCode.toLowerCase().startsWith(searchQuery.toLowerCase()));
        return customersArray.sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));
    }, [unprintedCustomerMap, searchQuery, type]);

    const displayItems = type === "printed" ? filteredPrintedGroups : filteredUnprintedCustomers;
    const isSelected = (item) => type === "printed" ? selectedPrintedCustomer === `${item.customerCode}-${item.billNo}` : selectedUnprintedCustomer === item.customerCode;

    return (
        <div key={`${type}-${lastUpdate || ''}`} className="w-full shadow-xl rounded-xl overflow-y-auto border border-black" style={{ backgroundColor: "#1ec139ff", maxHeight: "80.5vh", overflowY: "auto" }}>
            <div style={{ backgroundColor: "#006400" }} className="p-1 rounded-t-xl">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <h2 className="font-bold text-white whitespace-nowrap" style={{ fontSize: '14px' }}>
                        {type === "printed" ? "මුද්‍රණය කළ" : "මුද්‍රණය නොකළ"}
                    </h2>

                    {/* Only show the checkbox for the "printed" column */}
                    {type === "printed" && (
                        <div onClick={() => toggleCashFilter()} className="cursor-pointer transition-all border border-white rounded" style={{ width: '18px', height: '18px', backgroundColor: isCashFilterActive ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '90px', marginTop: '-22px' }}>
                            {isCashFilterActive && <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                        </div>
                    )}
                </div>

                <input
                    type="text"
                    placeholder={`සෙවීම ${type === "printed" ? "බිල්පත් අංකය/කේතය..." : "ගනුදෙනු කේතය..."}`}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value.toUpperCase())}
                    className="px-4 py-0.5 border rounded-xl focus:ring-2 focus:ring-blue-300 uppercase block mx-auto"
                    style={{ width: '169px' }}
                />
            </div>
            <div className="py-1">
                {displayItems.length === 0 ? (<p className="text-gray-700 p-2 text-center text-xs">වාර්තා නොමැත.</p>) : (
                    <ul className="flex flex-col px-1">
                        {displayItems.map((item) => {
                            let customerCode, displayText, totalAmount, billSales;
                            if (type === "printed") {
                                customerCode = item.customerCode;
                                // Show customer_code-bill_no in the printed section without total amount
                                displayText = `${item.customerCode}-${item.billNo}`;
                                billSales = allSales.filter(s => s.customer_code === item.customerCode && s.bill_no === item.billNo);
                                totalAmount = billSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
                            } else {
                                customerCode = item.customerCode;
                                displayText = item.customerCode;
                                billSales = allSales.filter(s => s.customer_code === item.customerCode && (s.bill_printed === 'N' || !s.bill_printed || s.bill_printed === ''));
                                totalAmount = billSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
                            }
                            const isItemSelected = isSelected(item);
                            // Remove the total amount from button text
                            const buttonText = displayText.replace(/\n/g, ' ');

                            return (
                                <li key={type === "printed" ? `${item.customerCode}-${item.billNo}` : item.customerCode} className="flex">
                                    <button
                                        onClick={() => handleCustomerClick(type, customerCode, item.billNo || null, billSales)}
                                        className={`py-1 mb-2 rounded-xl border ${isItemSelected ? "border-blue-600" : "bg-gray-50 hover:bg-gray-100 border-gray-200"}`}
                                        style={isItemSelected ? { backgroundColor: '#93C5FD', paddingLeft: '05px', width: '280px', textAlign: 'left' } : { paddingLeft: '1px', width: '280px', textAlign: 'left' }}
                                    >
                                        <span
                                            style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'inherit', width: '100%' }}
                                            className={`font-semibold ${isItemSelected ? 'text-black' : 'text-gray-700'}`}
                                            title={buttonText}
                                        >
                                            {buttonText}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
});

const ItemSummary = ({ sales }) => {

    const formatWeight = (value) => {
        if (!value) return "0";
        const num = parseFloat(value);
        return num % 1 === 0 ? num.toString() : num.toFixed(1);
    };

    const formatPacks = (value) => {
        if (!value) return "0";
        return parseInt(value).toString();
    };

    const summary = useMemo(() => {
        const result = {};
        sales.forEach(sale => {
            const itemName = sale.item_name || 'Unknown';
            if (!result[itemName]) result[itemName] = { totalWeight: 0, totalPacks: 0 };
            result[itemName].totalWeight += parseFloat(sale.weight) || 0;
            result[itemName].totalPacks += parseInt(sale.packs) || 0;
        });
        return result;
    }, [sales]);

    if (Object.keys(summary).length === 0) return null;

    const items = Object.entries(summary);

    const rows = [];
    for (let i = 0; i < items.length; i += 3) {
        rows.push(items.slice(i, i + 3));
    }

    return (
        <div style={{
            width: '100%',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: "'Segoe UI', Tahoma",
            marginTop: '10px'
        }}>
            <div style={{
                textAlign: 'center',
                marginBottom: '10px'
            }}>
                <span style={{ fontSize: '18px', fontWeight: '800' }}>Item Summary</span>
            </div>

            {rows.map((row, rowIndex) => (
                <div
                    key={rowIndex}
                    style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '5px',
                        backgroundColor: '#ffffff'
                    }}
                >
                    {row.map(([itemName, data]) => (
                        <div key={itemName} style={{ flex: 1 }}>

                            {/* Compact format */}
                            <span style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block'
                            }}>
                                {itemName}: {formatWeight(data.totalWeight)}kg/{formatPacks(data.totalPacks)}p
                            </span>

                        </div>
                    ))}

                    {row.length < 3 &&
                        Array.from({ length: 3 - row.length }).map((_, idx) => (
                            <div key={idx} style={{ flex: 1 }} />
                        ))
                    }
                </div>
            ))}
        </div>
    );
};


const SalesSummaryFooter = ({ sales, formatDecimal }) => {
    const totals = useMemo(() => {
        return sales.reduce((acc, s) => {
            const weight = parseFloat(s.weight) || 0;
            const price = parseFloat(s.price_per_kg) || 0;
            const packs = parseFloat(s.packs) || 0;
            const packCost = parseFloat(s.CustomerPackCost) || 0;
            const packLabour = parseFloat(s.CustomerPackLabour) || 0;
            acc.billTotal += (weight * price);
            acc.totalBagPrice += (packs * packCost);
            acc.totalLabour += (packs * packLabour);
            return acc;
        }, { billTotal: 0, totalBagPrice: 0, totalLabour: 0 });
    }, [sales]);

    const finalPayable = totals.billTotal + totals.totalBagPrice;

    return (
        <div className="flex flex-row flex-nowrap items-center justify-between w-full p-2 mt-2 rounded-xl border-2 border-blue-500 bg-gray-900 text-white font-bold shadow-lg overflow-hidden">
            <div className="flex items-center gap-4 px-3 border-r border-gray-700 flex-1 justify-center">
                <span className="text-gray-400 uppercase text-[10px] whitespace-nowrap">එකතුව:</span>
                <span className="text-white text-sm whitespace-nowrap" style={{ marginLeft: '6px' }}>
                    {formatDecimal(totals.billTotal)}
                </span>

            </div>
            <div className="flex items-center gap-2 px-3 border-r border-gray-700 flex-1 justify-center" style={{ marginLeft: '20px', transform: 'translateY(-24px)' }}>
                <span className="text-gray-400 uppercase text-[10px] whitespace-nowrap" style={{ marginLeft: '140px' }}>බෑග් මිල:</span>
                <span className="text-white text-sm whitespace-nowrap" style={{ marginLeft: '6px' }}>{formatDecimal(totals.totalBagPrice)}</span>
            </div>
            <div className="flex flex-row items-center whitespace-nowrap px-4 border-r border-gray-700 h-full ml-auto" style={{ transform: 'translateY(-48px)' }}>
                <span className="text-gray-400 uppercase text-[10px] mr-2" style={{ marginLeft: '310px' }}>කාම්කරු:</span>
                <span className="font-bold text-sm" style={{ marginLeft: '6px' }}>0</span>
            </div>
            <div className="flex flex-row items-center whitespace-nowrap px-4 border-r border-gray-700 h-full ml-auto" style={{ transform: 'translateY(-72px)' }}>
                <span className="text-gray-400 uppercase text-[10px] mr-2" style={{ marginLeft: '480px' }}>ගෙවිය:</span>
                <span className="font-bold text-sm text-yellow-400" style={{ marginLeft: '6px' }}>{formatDecimal(finalPayable)}</span>
            </div>
        </div>
    );
};

// --- Main Export Component ---
const initialFormData = { customer_code: "", customer_name: "", supplier_code: "", code: "", item_code: "", item_name: "", weight: "", price_per_kg: "", pack_due: "", total: "", packs: "", given_amount: "", pack_cost: "", telephone_no: "", };
const fieldOrder = ["telephone_no", "customer_code_input", "customer_code_select", "supplier_code", "item_code_select", "weight", "price_per_kg_grid_item", "packs", "total"];
const skipMap = { telephone_no: "customer_code_input", customer_code_input: "supplier_code", customer_code_select: "supplier_code", given_amount: "supplier_code", supplier_code: "item_code_select", item_code_select: "weight", price_per_kg: "packs", price_per_kg_grid_item: "packs" };

export default function SalesEntry({ printMode: propPrintMode = 'thermal', setPrintMode: propSetPrintMode }) {
    const [localPrintMode, setLocalPrintMode] = useState(propPrintMode || 'thermal');

    // Use propPrintMode if available, otherwise use local state
    const printMode = propPrintMode || localPrintMode;
    const setPrintMode = propSetPrintMode || setLocalPrintMode;

    const refs = {
        telephone_no: useRef(null), customer_code_input: useRef(null), customer_code_select: useRef(null), given_amount: useRef(null),
        supplier_code: useRef(null), item_code_select: useRef(null), item_name: useRef(null),
        weight: useRef(null), price_per_kg: useRef(null), packs: useRef(null), total: useRef(null),
        price_per_kg_grid_item: useRef(null),
    };
    const adminViewRef = useRef(null);

    const [state, setState] = useState({
        allSales: [], selectedPrintedCustomer: null, selectedUnprintedCustomer: null, editingSaleId: null,
        searchQueries: { printed: "", unprinted: "", farmerPrinted: "", farmerUnprinted: "" }, errors: {}, loanAmount: 0, isManualClear: false,
        isSubmitting: false, formData: initialFormData, packCost: 0, customerSearchInput: "", itemSearchInput: "",
        supplierSearchInput: "", currentBillNo: null, isLoading: false, customers: [], items: [], suppliers: [],
        forceUpdate: null, windowFocused: null, isPrinting: false, billSize: '3inch', priceManuallyChanged: false,
        gridPricePerKg: "", selectedSaleForBreakdown: null, showSavePhoneButton: false, isTelephoneValid: false,
        currentUser: null, bulkUpdateCustomerCode: "",
        isGivenAmountManuallyTouched: false, filterOnlyCash: false, customerProfilePic: null, supplierProfilePic: null, customerNameDisplay: "", supplierNameDisplay: "", isImageModalOpen: false, selectedImageData: { profile: null, nic_front: null, nic_back: null, title: "" }, selectedSalesIds: [], selectionCriteria: null, isBulkUpdateModalOpen: false, bulkUpdateSupplierCode: "", bulkUpdateContextMenu: { x: 0, y: 0, show: false }, isBulkPrintEnabled: true,
    });

    const setFormData = (updater) => setState(prev => ({ ...prev, formData: typeof updater === 'function' ? updater(prev.formData) : updater }));
    const updateState = (updates) => setState(prev => ({ ...prev, ...updates }));

    const { allSales, customerSearchInput, selectedPrintedCustomer, selectedUnprintedCustomer, editingSaleId,
        searchQueries, errors, loanAmount, isManualClear, formData, packCost, isLoading, customers,
        items, suppliers, isPrinting, billSize, gridPricePerKg, selectedSaleForBreakdown, currentUser,
    } = state;

    // --- Logic for Farmer Lists (Admin View) ---
    const printedFarmers = useMemo(() => {
        const groups = {};
        allSales.filter(s => s.supplier_bill_printed === 'Y').forEach(sale => {
            const code = sale.supplier_code;
            if (code && !groups[code]) groups[code] = { supplier_code: code };
        });
        return Object.values(groups);
    }, [allSales]);
    // Add this function to combine sales records for bulk printing
    const combineSalesForPrinting = (salesData) => {
        const combinedMap = new Map();

        salesData.forEach(sale => {
            // Create a unique key based on supplier_code, item_code, and price_per_kg
            const key = `${sale.supplier_code}|${sale.item_code}|${sale.price_per_kg}`;

            if (combinedMap.has(key)) {
                // Combine existing record with new one
                const existing = combinedMap.get(key);
                const newWeight = (parseFloat(existing.weight) || 0) + (parseFloat(sale.weight) || 0);
                const newPacks = (parseInt(existing.packs) || 0) + (parseInt(sale.packs) || 0);
                const newTotal = newWeight * (parseFloat(sale.price_per_kg) || 0);

                // Aggregate Kuliya and Pack Cost values
                const newKuliya = (parseFloat(existing.Kuliya) || 0) + (parseFloat(sale.Kuliya) || 0);
                const newPackCost = (parseFloat(existing.CustomerPackCost) || 0) + (parseFloat(sale.CustomerPackCost) || 0);

                combinedMap.set(key, {
                    ...existing,
                    weight: newWeight,
                    packs: newPacks,
                    total: newTotal,
                    Kuliya: newKuliya,
                    CustomerPackCost: newPackCost,
                    // Keep track of original IDs for marking as printed
                    original_ids: [...(existing.original_ids || [existing.id]), sale.id]
                });
            } else {
                // Add new record
                combinedMap.set(key, {
                    ...sale,
                    original_ids: [sale.id]
                });
            }
        });

        // Convert map back to array
        return Array.from(combinedMap.values());
    };
    //functions related to multiselect and bulk update
   const toggleSaleSelection = (saleId, e) => {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }

    const saleToSelect = displayedSales.find(s => s.id === saleId);
    if (!saleToSelect) return;

    const isCurrentlySelected = state.selectedSalesIds.includes(saleId);

    if (isCurrentlySelected) {
        setState(prev => {
            const newSelectedIds = prev.selectedSalesIds.filter(id => id !== saleId);
            return {
                ...prev,
                selectedSalesIds: newSelectedIds,
                selectionCriteria: newSelectedIds.length === 0 ? null : prev.selectionCriteria
            };
        });
        return;
    }
    
    // Case 1: No records selected yet - select this one and set criteria
    if (state.selectedSalesIds.length === 0) {
        setState(prev => ({
            ...prev,
            selectedSalesIds: [saleId],
            selectionCriteria: {
                customer_code: saleToSelect.customer_code,  // ← CHANGED from supplier_code
                item_code: saleToSelect.item_code
            }
        }));
        return;
    }

    // Case 2: Records already selected - validate if it matches criteria
    const matchesCriteria =
        saleToSelect.customer_code === state.selectionCriteria?.customer_code &&  // ← CHANGED
        saleToSelect.item_code === state.selectionCriteria?.item_code;

    if (matchesCriteria) {
        setState(prev => ({
            ...prev,
            selectedSalesIds: [...prev.selectedSalesIds, saleId]
        }));
    } else {
        alert(`❌ Cannot select this record!\n\n✓ Current selection allows only:\n   Customer: ${state.selectionCriteria?.customer_code}\n   Item: ${state.selectionCriteria?.item_code}\n\n✗ This record has:\n   Customer: ${saleToSelect.customer_code}\n   Item: ${saleToSelect.item_code}\n\nPlease clear selection or select matching records.`);
    }
};
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && state.bulkUpdateContextMenu.show) {
                closeContextMenu();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [state.bulkUpdateContextMenu.show]);

    // Handle right-click on selected records on bulk update
   const handleRightClick = (e, sale) => {
    e.preventDefault();
    e.stopPropagation();

    const isSelected = state.selectedSalesIds.includes(sale.id);

    if (!isSelected) {
        if (state.selectedSalesIds.length === 0) {
            setState(prev => ({
                ...prev,
                selectedSalesIds: [sale.id],
                selectionCriteria: {
                    customer_code: sale.customer_code,  // ← CHANGED from supplier_code
                    item_code: sale.item_code
                }
            }));
        } else {
            const matchesCriteria =
                sale.customer_code === state.selectionCriteria?.customer_code &&  // ← CHANGED
                sale.item_code === state.selectionCriteria?.item_code;

            if (matchesCriteria) {
                setState(prev => ({
                    ...prev,
                    selectedSalesIds: [...prev.selectedSalesIds, sale.id]
                }));
            } else {
                alert(`Cannot select this record!`);
                return;
            }
        }
    }

    setState(prev => ({
        ...prev,
        bulkUpdateContextMenu: {
            show: true,
            x: e.clientX,
            y: e.clientY
        },
        bulkUpdateCustomerCode: ""  // ← CHANGED
    }));
};
const handleBulkUpdateCustomer = async (newCustomerCode) => {
    const customerCodeToUpdate = newCustomerCode || state.bulkUpdateCustomerCode;
    const finalCustomerCode = customerCodeToUpdate.trim().toUpperCase();

    if (!finalCustomerCode) {
        alert("Please enter a customer code");
        return;
    }

    if (state.selectedSalesIds.length === 0) {
        alert("No sales selected");
        return;
    }

    try {
        updateState({ isSubmitting: true });

        const response = await api.post(routes.bulkUpdateCustomer, {
            sale_ids: state.selectedSalesIds,
            customer_code: finalCustomerCode
        });

        if (response.data.success) {
       
     
            // Full page refresh
            window.location.reload();
        } else {
            throw new Error(response.data.message || "Update failed");
        }
    } catch (error) {
        console.error("Bulk update error:", error);
        alert("Failed to update customer codes. Please try again.");
        updateState({ isSubmitting: false });
    }
};

    // Handle bulk update submission
    const handleBulkUpdateSupplier = async (newSupplierCode) => {
        // Use the passed parameter instead of state
        const supplierCodeToUpdate = newSupplierCode || state.bulkUpdateSupplierCode;
        const finalSupplierCode = supplierCodeToUpdate.trim().toUpperCase();

        if (!finalSupplierCode) {
            alert("Please enter a supplier code");
            return;
        }

        if (state.selectedSalesIds.length === 0) {
            alert("No sales selected");
            return;
        }

        try {
            // Show loading state
            updateState({ isSubmitting: true });

            // Send bulk update request
            const response = await api.post('/sales/bulk-update-supplier', {
                sale_ids: state.selectedSalesIds,
                supplier_code: finalSupplierCode
            });

            if (response.data.success) {
                // Update local state with new supplier codes
                const updatedSales = response.data.sales || [];
                const updatedSalesMap = {};
                updatedSales.forEach(sale => {
                    updatedSalesMap[sale.id] = sale;
                });

                updateState({
                    allSales: allSales.map(s => updatedSalesMap[s.id] ? updatedSalesMap[s.id] : s),
                    selectedSalesIds: [], // Clear selection after update
                    bulkUpdateContextMenu: { show: false, x: 0, y: 0 },
                    bulkUpdateSupplierCode: "", // Reset
                    isSubmitting: false
                });


            } else {
                throw new Error(response.data.message || "Update failed");
            }
        } catch (error) {
            console.error("Bulk update error:", error);
            alert("Failed to update supplier codes. Please try again.");
            updateState({ isSubmitting: false });
        }
    };

    // Close context menu
    const closeContextMenu = () => {
        setState(prev => ({
            ...prev,
            bulkUpdateContextMenu: { show: false, x: 0, y: 0 },
            bulkUpdateSupplierCode: "",
             bulkUpdateCustomerCode: "" 
        }));
    };
    //End of functions releated to multiselect and bulk update

    const unprintedFarmers = useMemo(() => {
        const groups = {};
        allSales.filter(s => s.supplier_bill_printed === 'N' || !s.supplier_bill_printed).forEach(sale => {
            const code = sale.supplier_code;
            if (code && !groups[code]) groups[code] = { supplier_code: code };
        });
        return Object.values(groups);
    }, [allSales]);

    const { newSales, printedSales, unprintedSales } = useMemo(() => ({
        newSales: allSales.filter(s => s.id && s.bill_printed !== 'Y' && s.bill_printed !== 'N'),
        printedSales: allSales.filter(s => s.bill_printed === 'Y'),
        unprintedSales: allSales.filter(s => s.bill_printed === 'N' || !s.bill_printed || s.bill_printed === '')
    }), [allSales]);

    const filterCustomers = (sales, query, searchByBillNo = false) => {
        const allCustomers = [...new Set(sales.map(s => s.customer_code))];
        if (!query) return allCustomers;
        const lowerQuery = query.toLowerCase();
        if (searchByBillNo) {
            const byBillNo = sales.filter(s => (s.bill_no?.toString() || '').toLowerCase().includes(lowerQuery)).map(s => s.customer_code);
            const byCode = allCustomers.filter(code => code.toLowerCase().includes(lowerQuery));
            return [...new Set([...byBillNo, ...byCode])];
        }
        return allCustomers.filter(code => code.toLowerCase().includes(lowerQuery));
    };

    const printedCustomers = useMemo(() => filterCustomers(printedSales, searchQueries.printed, true), [printedSales, searchQueries.printed]);
    const unprintedCustomers = useMemo(() => filterCustomers(unprintedSales, searchQueries.unprinted), [unprintedSales, searchQueries.unprinted]);

    const displayedSales = useMemo(() => {
        let sales = newSales;

        if (selectedUnprintedCustomer) {
            // Filter by customer code for unprinted records
            sales = [...sales, ...unprintedSales.filter(s => s.customer_code === selectedUnprintedCustomer)];
        }
        else if (selectedPrintedCustomer) {
            if (selectedPrintedCustomer.includes('-')) {
                // Split the key "CODE-BILLNO" and filter by both fields
                const [cCode, bNo] = selectedPrintedCustomer.split('-');
                sales = [...sales, ...printedSales.filter(s =>
                    s.customer_code === cCode && String(s.bill_no) === String(bNo)
                )];
            } else {
                // Fallback for single code selection
                sales = [...sales, ...printedSales.filter(s => s.customer_code === selectedPrintedCustomer)];
            }
        }

        return sales.slice().reverse();
    }, [newSales, unprintedSales, printedSales, selectedUnprintedCustomer, selectedPrintedCustomer]);

    const autoCustomerCode = useMemo(() => displayedSales.length > 0 && !isManualClear ? displayedSales[0].customer_code || "" : "", [displayedSales, isManualClear]);
    const currentBillNo = useMemo(() => {
        if (selectedPrintedCustomer && selectedPrintedCustomer.includes('-')) return selectedPrintedCustomer.split('-')[1] || "N/A";
        if (selectedPrintedCustomer) return printedSales.find(s => s.customer_code === selectedPrintedCustomer)?.bill_no || "N/A";
        return "";
    }, [selectedPrintedCustomer, printedSales]);

    const formatDecimal = (value) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(value || 0));
    };


    const fetchLoanAmount = async (customerCode) => {
        if (!customerCode) return updateState({ loanAmount: 0 });
        try {
            const response = await api.post(routes.getLoanAmount, { customer_short_name: customerCode });
            updateState({ loanAmount: parseFloat(response.data.total_loan_amount) || 0 });
        } catch { updateState({ loanAmount: 0 }); }
    };

    const fetchInitialData = async () => {
        try {
            const userData = JSON.parse(localStorage.getItem('user'));
            const [resSales, resCustomers, resItems, resSuppliers] = await Promise.all([
                api.get(routes.sales), api.get(routes.customers), api.get(routes.items), api.get(routes.suppliers)
            ]);
            const salesData = resSales.data.data || resSales.data.sales || resSales.data || [];
            const customersData = resCustomers.data.data || resCustomers.data.customers || resCustomers.data || [];
            const itemsData = resItems.data.data || resItems.data.items || resItems.data || [];
            const suppliersData = resSuppliers.data.data || resSuppliers.data.suppliers || resSuppliers.data || [];
            updateState({
                allSales: salesData,
                customers: customersData,
                items: itemsData,
                suppliers: suppliersData,
                isLoading: false,
                currentUser: userData
            });
        } catch {
            updateState({ errors: { form: 'Failed to load data. Check console.' } });
        }
    };

    useEffect(() => {
        if (displayedSales.length > 0) {
            const totals = displayedSales.reduce((acc, s) => {
                const weight = parseFloat(s.weight) || 0;
                const price = parseFloat(s.price_per_kg) || 0;
                const packs = parseFloat(s.packs) || 0;
                const pCost = parseFloat(s.CustomerPackCost) || 0;
                const pLabour = parseFloat(s.CustomerPackLabour) || 0;
                acc.billTotal += (weight * price);
                acc.totalBagPrice += (packs * pCost);
                acc.totalLabour += (packs * pLabour);
                return acc;
            }, { billTotal: 0, totalBagPrice: 0, totalLabour: 0 });
            const calculatedFinal = totals.billTotal + totals.totalBagPrice;
            //  setFormData(prev => prev.given_amount === null || prev.given_amount === "" ? { ...prev, given_amount: calculatedFinal.toFixed(2) } : prev);
        } else {
            setFormData(prev => ({ ...prev, given_amount: "" }));
        }
    }, [displayedSales]);
    useEffect(() => {
        // Determine the code to search for: manually entered, phone-matched, or sidebar-selected
        const code = formData.customer_code || autoCustomerCode;

        if (code && customers.length > 0) {
            const customer = customers.find(c =>
                String(c.short_name).toUpperCase() === String(code).toUpperCase()
            );

            if (customer) {
                const baseUrl = "https://goviraju.lk/DBS_backend_30500/application/public";
                let fileName = customer.profile_pic;
                let fullPath = null;

                if (fileName) {
                    if (fileName.startsWith('http')) {
                        fullPath = fileName;
                    } else {
                        const cleanFileName = fileName.replace('public/', '');
                        const subPath = cleanFileName.includes('customers')
                            ? cleanFileName
                            : `customers/${cleanFileName}`;

                        fullPath = `${baseUrl}/storage/${subPath}`;
                    }
                }

                updateState({
                    customerProfilePic: fullPath,
                    customerNameDisplay: customer.name || ""
                });
            } else {
                updateState({ customerProfilePic: null, customerNameDisplay: "" });
            }
        } else {
            updateState({ customerProfilePic: null, customerNameDisplay: "" });
        }
    }, [formData.customer_code, autoCustomerCode, customers]);
    // useEffect to fetch Supplier profile pic
    useEffect(() => {
        const code = formData.supplier_code;
        if (code && suppliers.length > 0) {
            const supplier = suppliers.find(s =>
                String(s.code).toUpperCase() === String(code).toUpperCase()
            );

            if (supplier) {
                // Root path where the 'storage' symlink is located
                const baseUrl = "https://goviraju.lk/DBS_backend_30500/application/public";
                let fileName = supplier.profile_pic;

                let fullPath = null;

                if (fileName) {
                    if (fileName.startsWith('http')) {
                        // Use directly if it's already a full URL
                        fullPath = fileName;
                    } else {
                        // Check if 'suppliers/profiles' is already in the filename string from DB
                        // If not, we manually add it to match your folder structure
                        const subPath = fileName.includes('suppliers/profiles')
                            ? fileName.replace('public/', '')
                            : `suppliers/profiles/${fileName.replace('public/', '')}`;

                        fullPath = `${baseUrl}/storage/${subPath}`;
                    }
                }

                updateState({
                    supplierProfilePic: fullPath,
                    supplierNameDisplay: supplier.name || ""
                });
            } else {
                updateState({ supplierProfilePic: null, supplierNameDisplay: "" });
            }
        } else {
            updateState({ supplierProfilePic: null, supplierNameDisplay: "" });
        }
    }, [formData.supplier_code, suppliers]);
    useEffect(() => {
        const w = parseFloat(formData.weight) || 0;
        const p = parseFloat(formData.price_per_kg) || 0;
        const packs = parseInt(formData.packs) || 0;
        const packDue = parseFloat(formData.pack_due) || 0;
        const total = (w * p);
        setFormData(prev => ({ ...prev, total: Number(total.toFixed(2)) }));
        if (!state.priceManuallyChanged) updateState({ gridPricePerKg: formData.price_per_kg });
    }, [formData.weight, formData.price_per_kg, formData.packs, formData.pack_due]);

    useEffect(() => {
        const handleWindowFocus = () => updateState(prev => ({ ...prev, windowFocused: Date.now() }));
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, []);

    useEffect(() => { fetchInitialData(); refs.customer_code_input.current?.focus(); }, []);

    const handleKeyDown = async (e, currentFieldName) => {
        if (e.key === "Enter") {
            e.preventDefault();

            // 1. Handle Given Amount
            if (currentFieldName === "given_amount") {
                const success = await handleSubmitGivenAmount(e);
                if (success) {
                    handlePrintAndClear();
                }
                return;
            }

            // 2. Handle Item Packs
            if (currentFieldName === "packs") return handleSubmit(e);

            // 3. Logic for TELEPHONE input (Reverse Lookup)
            if (currentFieldName === "telephone_no") {
                updateState({ showSavePhoneButton: false });
                refs.customer_code_input.current?.focus();
                return;
            }

            // 4. Logic for CUSTOMER CODE input
            if (currentFieldName === "customer_code_input") {
                const code = (formData.customer_code || autoCustomerCode).trim().toUpperCase();

                if (code) {
                    const match = customers.find(c => String(c.short_name).toUpperCase() === code);

                    if (match) {
                        setFormData(prev => ({
                            ...prev,
                            customer_name: match.name || ""
                        }));
                        fetchLoanAmount(code);
                    } else {
                        console.log("Customer not found in local data");
                    }
                }

                refs.supplier_code.current?.focus();
                return;
            }

            // MODIFIED: Logic for WEIGHT field
            if (currentFieldName === "weight") {
                // FIRST: Check if required fields are empty (customer_code, supplier_code, item_code)
                const customerCode = (formData.customer_code || autoCustomerCode).trim();
                const supplierCode = formData.supplier_code?.trim();
                const itemCode = formData.item_code?.trim();

                const areRequiredFieldsEmpty = !customerCode || !supplierCode || !itemCode;

                // Get the weight value
                const weightValue = formData.weight?.trim();

                // If required fields are empty
                if (areRequiredFieldsEmpty) {
                    // ONLY move to next field if weight has a value
                    if (weightValue && weightValue !== "") {
                        setTimeout(() => {
                            refs.price_per_kg_grid_item.current?.focus();
                            refs.price_per_kg_grid_item.current?.select();
                        }, 50);
                    }
                    // If weight is empty, DO NOTHING - stay on weight field
                    // No else clause - cursor stays on weight field
                    return; // Exit early to prevent any navigation
                }

                // ONLY RUN VALIDATION IF REQUIRED FIELDS ARE NOT EMPTY
                const requiredBeforeWeight = [
                    { key: "customer_code", ref: "customer_code_input", label: "Customer Code" },
                    { key: "supplier_code", ref: "supplier_code", label: "Supplier Code" },
                    { key: "item_code", ref: "item_code_select", label: "Item" }
                ];

                let isValid = true;
                for (const field of requiredBeforeWeight) {
                    const value = field.key === "customer_code"
                        ? (formData.customer_code || autoCustomerCode)
                        : formData[field.key];

                    if (value === null || value === undefined || value.toString().trim() === "") {
                        updateState({ errors: { form: `කරුණාකර ${field.label} ඇතුළත් කරන්න` } });
                        const targetRef = refs[field.ref];
                        if (targetRef?.current) {
                            targetRef.current.focus();
                            if (!field.ref.includes("select")) targetRef.current.select();
                        }
                        isValid = false;
                        break;
                    }
                }

                // If validation fails, stay on weight field
                if (!isValid) {
                    return;
                }
            }

            // 6. General Navigation Logic (only if validation passes or field is not weight)
            let nextFieldName = skipMap[currentFieldName];
            if (!nextFieldName) {
                const currentIndex = fieldOrder.indexOf(currentFieldName);
                let nextIndex = currentIndex + 1;
                while (nextIndex < fieldOrder.length &&
                    ["customer_code_select", "item_name", "total"].includes(fieldOrder[nextIndex])) {
                    nextIndex++;
                }
                nextFieldName = nextIndex < fieldOrder.length ? fieldOrder[nextIndex] : "customer_code_input";
            }

            const nextRef = refs[nextFieldName];
            if (nextRef?.current) {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        nextRef.current.focus();
                        if (!nextFieldName.includes("select")) nextRef.current.select();
                    }, 0);
                });
            }
        }
    };

    const salesTotal = displayedSales.reduce((sum, s) => sum + ((parseFloat(s.weight) || 0) * (parseFloat(s.price_per_kg) || 0)), 0);
    const packCostTotal = displayedSales.reduce((sum, s) => sum + ((parseFloat(s.CustomerPackCost) || 0) * (parseFloat(s.packs) || 0)), 0);
    const totalSalesValue = salesTotal + packCostTotal;

    const handleInputChange = (field, value) => {
        if (field === 'price_per_kg') {
            setFormData(prev => ({ ...prev, [field]: value }));
            updateState({ priceManuallyChanged: true, gridPricePerKg: value });
        } else if (field === 'price_per_kg_grid_item') {
            setFormData(prev => ({ ...prev, 'price_per_kg': value }));
            updateState({ gridPricePerKg: value, priceManuallyChanged: false });
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }

        if (field === 'customer_code') {
            const trimmedValue = value.trim();
            updateState({ isManualClear: value === '' });
            const matchingCustomer = unprintedCustomers.find(code => code.toLowerCase() === trimmedValue.toLowerCase());

            if (matchingCustomer) updateState({ selectedUnprintedCustomer: matchingCustomer, selectedPrintedCustomer: null });
            else if (selectedUnprintedCustomer) updateState({ selectedUnprintedCustomer: null });

            if (!trimmedValue) {
                updateState({ loanAmount: 0 });
                setFormData(prev => ({ ...prev, given_amount: "" }));
            }

            const customer = customers.find(c => c.short_name === value);
            const customerSales = allSales.filter(s => s.customer_code === trimmedValue);
            const firstSale = customerSales[0];
            const givenAmount = firstSale?.given_amount || "";
            setFormData(prev => ({ ...prev, customer_name: customer?.name || "", given_amount: givenAmount }));
            fetchLoanAmount(trimmedValue);

            // Check if both conditions are met to show the save button
            const telephoneNo = formData.telephone_no || "";
            const hasValidPhone = telephoneNo.length === 10 && /^\d+$/.test(telephoneNo);
            updateState({
                showSavePhoneButton: value.trim().length > 0 && hasValidPhone
            });
        }

        if (field === 'telephone_no') {
            // Check if phone number has exactly 10 digits
            const isValidPhone = value.length === 10 && /^\d+$/.test(value);
            updateState({ isTelephoneValid: isValidPhone });

            // Show save button only if customer code is filled AND phone number has 10 digits
            const customerCode = formData.customer_code || autoCustomerCode;
            updateState({
                showSavePhoneButton: customerCode.trim().length > 0 && isValidPhone
            });
        }

        if (field === 'supplier_code') setFormData(prev => ({ ...prev, supplier_code: value }));
        if (field === "given_amount") {
            updateState({ isGivenAmountManuallyTouched: true });
        }
    };
    const handleItemSelect = (selectedOption) => {
        if (selectedOption) {
            const { item } = selectedOption;
            const fetchedPackDue = parseFloat(item?.pack_due) || 0;
            const fetchedPackCost = parseFloat(item?.pack_cost) || 0;

            setFormData(prev => ({
                ...prev,
                item_code: item.no,
                item_name: item.type,
                pack_due: fetchedPackDue
            }));

            updateState({
                packCost: fetchedPackCost,
                itemSearchInput: "",
                gridPricePerKg: formData.price_per_kg || ""
            });

            setTimeout(() => refs.weight.current?.focus(), 100);
        } else {
            setFormData(prev => ({
                ...prev,
                item_code: "",
                item_name: "",
                pack_due: ""
            }));
            updateState({ packCost: 0, itemSearchInput: "" });
        }
    };

    const handleCustomerSelect = (selectedOption) => {
        const short = selectedOption ? selectedOption.value : "";
        const customer = customers.find(x => String(x.short_name) === String(short));
        updateState({ selectedUnprintedCustomer: unprintedCustomers.includes(short) ? short : null, selectedPrintedCustomer: null, customerSearchInput: "" });
        const existingGivenAmount = allSales.find(s => s.customer_code === short)?.given_amount || "";
        setFormData(prev => ({ ...prev, customer_code: short || "", customer_name: customer?.name || "", given_amount: existingGivenAmount }));
        fetchLoanAmount(short);
        updateState({ isManualClear: false });
        setTimeout(() => { refs.price_per_kg.current?.focus(); refs.price_per_kg.current?.select(); }, 100);
    };
    //function to display customer image
    const handleImageClick = (entityType) => {
        const code = entityType === 'customer' ? (formData.customer_code || autoCustomerCode) : formData.supplier_code;
        const list = entityType === 'customer' ? customers : suppliers;

        const person = list.find(p =>
            String(entityType === 'customer' ? p.short_name : p.code).toUpperCase() === String(code).toUpperCase()
        );

        if (person) {
            updateState({
                isImageModalOpen: true,
                selectedImageData: {
                    profile: entityType === 'customer' ? state.customerProfilePic : state.supplierProfilePic,
                    nic_front: person.nic_front,
                    nic_back: person.nic_back,
                    title: person.name || code,
                    type: entityType // <--- ADD THIS LINE
                }
            });
        }
    };

   const handleEditClick = (sale) => {
    // If same record clicked again → clear fields EXCEPT customer/contact fields
    if (state.editingSaleId === sale.id) {
        setFormData((prev) => ({
            ...prev,
            customer_code: sale.customer_code || "",
            customer_name: sale.customer_name || "",
            // PRESERVE TELEPHONE:
            telephone_no: prev.telephone_no || "",
            supplier_code: "",
            item_code: "",
            item_name: "",
            weight: "",
            price_per_kg: "",
            pack_due: "",
            total: "",
            packs: ""
        }));

        updateState({
            editingSaleId: null,
            isManualClear: true,
            priceManuallyChanged: false,
            gridPricePerKg: "",
            selectedSaleForBreakdown: null
        });

        setTimeout(() => {
            refs.supplier_code?.current?.focus();
            refs.supplier_code?.current?.select();
        }, 0);

        return;
    }

    // === Normal behavior when selecting a record to edit ===
    let fetchedPackDue = sale.pack_due || "";
    if (sale.item_code) {
        const matchingItem = items.find(i => String(i.no) === String(sale.item_code));
        fetchedPackDue = parseFloat(matchingItem?.pack_due) || sale.pack_due || "";
    }

    setFormData((prev) => ({
        ...sale,
        // Ensure we explicitly map these so they don't get lost
        item_name: sale.item_name || "",
        customer_code: sale.customer_code || "",
        customer_name: sale.customer_name || "",
        // PRESERVE TELEPHONE from the current form state or the sale object
        telephone_no: sale.telephone_no || prev.telephone_no || "",
        supplier_code: sale.supplier_code || "",
        item_code: sale.item_code || "",
        weight: sale.weight || "",
        price_per_kg: sale.price_per_kg || "",
        pack_due: fetchedPackDue,
        total: sale.total || "",
        packs: sale.packs || ""
    }));

    updateState({
        editingSaleId: sale.id,
        isManualClear: false,
        priceManuallyChanged: false,
        gridPricePerKg: sale.price_per_kg || "",
        selectedSaleForBreakdown: sale
    });

    // FIX: Set focus to weight field and ensure Enter key navigation works
    setTimeout(() => {
        if (refs.weight.current) {
            refs.weight.current.focus();
            // Select the text so user can type over it if they want
            refs.weight.current.select();
            
            // Add a one-time keydown listener to handle Enter when value hasn't changed
            const handleWeightEnter = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    // Remove this listener to avoid duplicates
                    refs.weight.current.removeEventListener('keydown', handleWeightEnter);
                    // Move focus to price field
                    if (refs.price_per_kg_grid_item.current) {
                        refs.price_per_kg_grid_item.current.focus();
                        refs.price_per_kg_grid_item.current.select();
                    }
                }
            };
            
            // Remove any existing listener first to avoid duplicates
            refs.weight.current.removeEventListener('keydown', handleWeightEnter);
            // Add the new listener
            refs.weight.current.addEventListener('keydown', handleWeightEnter);
        }
    }, 0);
};

    const handleClearForm = (clearBillNo = false) => {
        setFormData(initialFormData);
        updateState({ editingSaleId: null, loanAmount: 0, isManualClear: false, packCost: 0, customerSearchInput: "", itemSearchInput: "", supplierSearchInput: "", priceManuallyChanged: false, gridPricePerKg: "", isGivenAmountManuallyTouched: false, selectedSaleForBreakdown: null, ...(clearBillNo && { currentBillNo: null }) });
    };

    const handleDeleteRecord = async (saleId) => {
        if (!saleId || !window.confirm("Are you sure you want to delete this sales record?")) return;
        try {
            await api.delete(`${routes.sales}/${saleId}`);
            updateState({ allSales: allSales.filter(s => s.id !== saleId) });
            if (editingSaleId === saleId) handleClearForm();
        } catch (error) { updateState({ errors: { form: error.response?.data?.message || error.message } }); }
    };

    const handleSubmitGivenAmount = async (e) => {
        if (e) e.preventDefault();
        updateState({ errors: {} });

        const customerCode = (formData.customer_code || autoCustomerCode).trim().toUpperCase();
        if (!customerCode) return null;

        const salesToUpdate = displayedSales.filter(s => s.id);
        if (salesToUpdate.length === 0) return null;

        try {
            // 1. Get the entered amount
            const currentInputAmount = parseFloat(formData.given_amount.toString().replace(/,/g, "")) || 0;

            // 2. DETECT CREDIT STATUS based on your calculated logic
            // We calculate it here to know if we should block the process before the API call
            const totals = salesToUpdate.reduce((acc, s) => {
                const weight = parseFloat(s.weight) || 0;
                const price = parseFloat(s.price_per_kg) || 0;
                const packs = parseFloat(s.packs) || 0;
                const pCost = parseFloat(s.CustomerPackCost) || 0;
                const pLabour = parseFloat(s.CustomerPackLabour) || 0;
                acc.billTotal += (weight * price);
                acc.totalBagPrice += (packs * pCost);
                acc.totalLabour += (packs * pLabour);
                return acc;
            }, { billTotal: 0, totalBagPrice: 0, totalLabour: 0 });

            const autoCalculatedGrandTotal = totals.billTotal + totals.totalBagPrice;
            const isCredit = Math.abs(currentInputAmount - autoCalculatedGrandTotal) > 0.01;
            const creditTransactionStatus = isCredit ? 'Y' : 'N';

            // 4. PROCEED: Update database with the determined status
            const updatePromises = salesToUpdate.map(sale =>
                api.put(`${routes.sales}/${sale.id}/given-amount`, {
                    given_amount: currentInputAmount,
                    credit_transaction: creditTransactionStatus
                })
            );

            const results = await Promise.all(updatePromises);
            updateState({ isGivenAmountManuallyTouched: false });

            const updatedSalesFromApi = results.map(response => response.data.sale);
            const updatedSalesMap = {};
            updatedSalesFromApi.forEach(sale => { updatedSalesMap[sale.id] = sale; });

            updateState({
                allSales: allSales.map(s => updatedSalesMap[s.id] ? updatedSalesMap[s.id] : s)
            });

            return updatedSalesFromApi;
        } catch (error) {
            updateState({ errors: { form: error.response?.data?.message || error.message } });
            return null;
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (state.isSubmitting) return;

        // --- 1. VALIDATION LOGIC ---
        const requiredFields = [
            { key: "customer_code", ref: "customer_code_input", label: "Customer Code" },
            { key: "supplier_code", ref: "supplier_code", label: "Supplier Code" },
            { key: "item_code", ref: "item_code_select", label: "Item" },
            { key: "weight", ref: "weight", label: "Weight" },
            { key: "packs", ref: "packs", label: "Packs" }
        ];

        for (const field of requiredFields) {
            const value = formData[field.key];
            if (value === null || value === undefined || value.toString().trim() === "") {
                updateState({ errors: { form: `කරුණාකර ${field.label} ඇතුළත් කරන්න` } });
                const targetRef = refs[field.ref];
                if (targetRef?.current) {
                    targetRef.current.focus();
                    if (!field.ref.includes("select")) targetRef.current.select();
                }
                return;
            }
        }

        // --- 2. PRE-FLIGHT PREPARATION ---
        updateState({ errors: {}, isSubmitting: true });

        // Capture these now so they are available for the reset after the async gap
        const customerCode = (formData.customer_code || autoCustomerCode).toUpperCase();
        const currentSupplierCode = formData.supplier_code;
        const currentCustomerName = formData.customer_name;
        const currentTelephone = formData.telephone_no;
        const shouldUpdateRelatedPrice = state.priceManuallyChanged;

        try {
            const isEditing = editingSaleId !== null;

            // --- 3. BILLING LOGIC ---
            let billPrintedStatus = undefined, billNoToUse = null;
            if (!isEditing) {
                if (state.currentBillNo) {
                    billPrintedStatus = 'Y';
                    billNoToUse = state.currentBillNo;
                } else if (selectedPrintedCustomer) {
                    billPrintedStatus = 'Y';
                    billNoToUse = selectedPrintedCustomer.includes('-')
                        ? selectedPrintedCustomer.split('-')[1]
                        : printedSales.find(s => s.customer_code === selectedPrintedCustomer)?.bill_no;
                } else if (selectedUnprintedCustomer) {
                    billPrintedStatus = 'N';
                }
            }

            const payload = { supplier_code: currentSupplierCode.toUpperCase(), customer_code: customerCode, customer_name: currentCustomerName, item_code: formData.item_code, item_name: formData.item_name, weight: parseFloat(formData.weight) || 0, price_per_kg: parseFloat(formData.price_per_kg) || 0, pack_due: parseFloat(formData.pack_due) || 0, total: parseFloat(formData.total) || 0, packs: parseFloat(formData.packs) || 0, given_amount: formData.given_amount ? parseFloat(formData.given_amount) : null, ...(billPrintedStatus && { bill_printed: billPrintedStatus }), ...(billNoToUse && { bill_no: billNoToUse }), update_related_price: shouldUpdateRelatedPrice };
            const url = isEditing ? `${routes.sales}/${editingSaleId}` : routes.sales;
            const method = isEditing ? "put" : "post";

            // --- 4. API EXECUTION ---
            const response = await api[method](url, payload);

            // --- 5. DATA SYNC ---
            let updatedSales = response.data.sales || [response.data.sale || response.data.data || response.data];
            const updatedIds = updatedSales.map(s => s.id);
            const newAllSales = allSales.filter(s => !updatedIds.includes(s.id)).concat(updatedSales);

            // We update everything in one cycle to prevent multiple re-renders
            setFormData({ ...initialFormData, customer_code: customerCode, customer_name: currentCustomerName, telephone_no: currentTelephone, supplier_code: currentSupplierCode });
            updateState({ allSales: newAllSales, editingSaleId: null, isManualClear: false, isSubmitting: false, priceManuallyChanged: false, gridPricePerKg: "" });

            // Immediate focus (no timeout) for faster data entry workflow
            if (refs.supplier_code.current) {
                refs.supplier_code.current.focus();
                refs.supplier_code.current.select();
            }

        } catch (error) {
            updateState({
                errors: { form: error.response?.data?.message || error.message || "An error occurred" },
                isSubmitting: false
            });
        }
    };
    const handleCustomerClick = async (type, customerCode, billNo = null, salesRecords = []) => {
        if (state.isPrinting) return;

        if (currentUser?.role === 'Admin') {
            console.log("Admin user clicked customer:", { customerCode, billNo, salesRecords });
            console.log("adminViewRef current:", adminViewRef.current);

            // Call the function from AdminView to open customer bill modal
            if (adminViewRef.current && adminViewRef.current.openCustomerBill) {
                adminViewRef.current.openCustomerBill(customerCode, billNo, salesRecords);
            } else {
                console.error("AdminView ref not available", adminViewRef.current);
                alert("Customer bill view is loading. Please try again.");
            }
            return;
        }

        const isPrinted = type === 'printed';
        let selectionKey = customerCode;
        if (isPrinted && billNo) selectionKey = `${customerCode}-${billNo}`;
        const isCurrentlySelected = isPrinted ? selectedPrintedCustomer === selectionKey : selectedUnprintedCustomer === selectionKey;

        if (isPrinted) {
            updateState({
                selectedPrintedCustomer: isCurrentlySelected ? null : selectionKey,
                selectedUnprintedCustomer: null,
                currentBillNo: isCurrentlySelected ? null : billNo
            });
        } else {
            updateState({
                selectedUnprintedCustomer: isCurrentlySelected ? null : selectionKey,
                selectedPrintedCustomer: null,
                currentBillNo: null
            });
        }

        const customer = customers.find(x => String(x.short_name).toUpperCase() === String(customerCode).toUpperCase());

        if (!isCurrentlySelected) {
            // --- NEW CALCULATION LOGIC FOR GIVEN AMOUNT ---
            // We calculate the sum of the records that are about to be displayed
            const totals = salesRecords.reduce((acc, s) => {
                const weight = parseFloat(s.weight) || 0;
                const price = parseFloat(s.price_per_kg) || 0;
                const packs = parseFloat(s.packs) || 0;
                const pCost = parseFloat(s.CustomerPackCost) || 0;

                acc.billTotal += (weight * price);
                acc.totalBagPrice += (packs * pCost);

                return acc;
            }, { billTotal: 0, totalBagPrice: 0, totalLabour: 0 });

            const calculatedFinal = totals.billTotal + totals.totalBagPrice;

            try {
                let fetchedGivenAmount = "";
                // If it's a printed bill, try to fetch the amount already stored
                if (isPrinted) {
                    try {
                        const response = await api.get(`${routes.getCustomerGivenAmount}/${customerCode}`);
                        fetchedGivenAmount = response.data?.given_amount ?? calculatedFinal.toFixed(2);
                    } catch (error) {
                        fetchedGivenAmount = salesRecords[0]?.given_amount || calculatedFinal.toFixed(2);
                    }
                }

                setFormData({
                    ...initialFormData,
                    customer_code: customerCode,
                    customer_name: customer?.name || "",
                    telephone_no: customer?.telephone_no || "",
                    given_amount: fetchedGivenAmount // This fills the field immediately
                });

                fetchLoanAmount(customerCode);
                setTimeout(() => refs.supplier_code.current?.focus(), 50);

            } catch (error) {
                setFormData({
                    ...initialFormData,
                    customer_code: customerCode,
                    customer_name: customer?.name || "",
                    telephone_no: customer?.telephone_no || "",
                    given_amount: calculatedFinal.toFixed(2)
                });
                fetchLoanAmount(customerCode);
            }
        } else {
            handleClearForm();
        }

        updateState({ editingSaleId: null, isManualClear: false, customerSearchInput: "", priceManuallyChanged: false, gridPricePerKg: "" });
    };
    const handleMarkAllProcessed = async () => {
        const salesToProcess = [...newSales, ...unprintedSales];
        if (salesToProcess.length === 0) return;
        try {
            const response = await api.post(routes.markAllProcessed, { sales_ids: salesToProcess.map(s => s.id) });
            if (response.data.success) {
                updateState({ allSales: allSales.map(s => salesToProcess.some(ps => ps.id === s.id) ? { ...s, bill_printed: "N" } : s) });
                handleClearForm();
                updateState({ selectedUnprintedCustomer: null, selectedPrintedCustomer: null });
                [50, 100, 150, 200, 250].forEach(timeout => setTimeout(() => refs.customer_code_input.current?.focus(), timeout));
            }
        } catch (err) { console.error("Failed to mark sales as processed:", err.message); }
    };
    const printSingleContent = async (html, customerName) => {
        return new Promise((resolve) => {
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) { alert("Please allow pop-ups for printing"); resolve(); return; }
            printWindow.document.open();
            printWindow.document.write(`<!DOCTYPE html><html><head><title>Print Bill - ${customerName}</title><style>body { margin: 0; padding: 20px; }@media print { body { padding: 0; } }</style></head><body>${html}<script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 1000); }, 500); }; window.onafterprint = function() { setTimeout(function() { window.close(); }, 500); };</script></body></html>`);
            printWindow.document.close();
            const checkPrintWindow = setInterval(() => { if (printWindow.closed) { clearInterval(checkPrintWindow); resolve(); } }, 500);
            setTimeout(() => { clearInterval(checkPrintWindow); if (!printWindow.closed) printWindow.close(); resolve(); }, 10000);
        });
    };

    const buildFullReceiptHTML = (salesData, billNo, customerName, mobile, globalLoanAmount = 0, billSize = '3inch') => {
        return ThermalBillHTML({ salesData, billNo, customerName, mobile, globalLoanAmount, billSize });
    };

    const formatReceiptValue = (value) => {
        if (value === null || value === undefined || value === '') return '0.00';
        const num = parseFloat(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2);
    };
    const buildA4ReceiptHTML = (salesData, billNo, customerName, mobile, globalLoanAmount = 0) => {
        return A4BillHTML({ salesData, billNo, customerName, mobile, globalLoanAmount });
    };
    // In your SalesEntry component, modify the handlePrintAndClear function:

    const handlePrintAndClear = async () => {
        let salesData = displayedSales.filter(s => s.id);

        if (!salesData.length) {
            alert("මුද්‍රණය කිරීමට දත්ත නොමැත!");
            return;
        }

        // Apply bulk printing combination if enabled
        const shouldCombine = state.isBulkPrintEnabled;
        let printData = salesData;

        if (shouldCombine) {
            printData = combineSalesForPrinting(salesData);
            if (printData.length < salesData.length) {
                console.log(`Combined ${salesData.length} records into ${printData.length} records for printing`);
            }
        }

        // --- COMMISSION VALIDATION ---
        for (const s of printData) {
            if (parseFloat(s.price_per_kg) === parseFloat(s.SupplierPricePerKg)) {
                const errorMsg = `කේතය: ${s.supplier_code} හි කොමිස් මුදල් අඩුකර නොමැත. කරුණාකර පාරිභෝගිකයා පද්ධතියට ඇතුළත් කර අදාළ ඡායාරූප (Profile, NIC) එක් කරන්න.`;
                alert(errorMsg);
                return;
            }
        }

        // --- ZERO PRICE VALIDATION ---
        const hasZeroPrice = printData.some(s => parseFloat(s.price_per_kg) === 0);
        if (hasZeroPrice) {
            alert("මිල 0 ලෙස ඇති අයිතම මුද්‍රණය කළ නොහැක.");
            return;
        }

        try {
            updateState({ isPrinting: true });

            const customerCode = salesData[0].customer_code || "N/A";
            const customerName = salesData[0].customer_code || salesData[0].customer_code || customerCode;
            const mobile = salesData[0].mobile || "0777672838 / 071437115";

            let currentLoan = 0;
            try {
                const loanRes = await api.post(routes.getLoanAmount, {
                    customer_short_name: customerCode
                });
                currentLoan = parseFloat(loanRes.data.total_loan_amount) || 0;
            } catch (e) {
                console.warn("Loan fetch failed");
            }

            // Get original IDs for marking as printed
            let idsToMark = salesData.map(s => s.id);
            if (shouldCombine) {
                idsToMark = printData.flatMap(s => s.original_ids);
            }

            const printResponse = await api.post(routes.markPrinted, {
                sales_ids: idsToMark,
                telephone_no: formData.telephone_no,
                customer_code: customerCode,
                customer_name: customerName,
                loan_amount: currentLoan
            });

            if (printResponse.data.status !== "success") {
                throw new Error("මුද්‍රණය අසාර්ථකයි");
            }

            const billNo = printResponse.data.bill_no || "";

            // FIXED: Use the printMode prop to determine which template to use
            let receiptHtml;
            if (printMode === 'a4') {
                // Use A4 template
                receiptHtml = buildA4ReceiptHTML(printData, billNo, customerName, mobile, currentLoan);
            } else {
                // Use Thermal template (default)
                receiptHtml = buildFullReceiptHTML(printData, billNo, customerName, mobile, currentLoan, billSize);
            }

            // Update local state before reload
            updateState({
                allSales: allSales.map(s =>
                    idsToMark.includes(s.id)
                        ? { ...s, bill_printed: "Y", bill_no: billNo }
                        : s
                ),
                selectedPrintedCustomer: null,
                selectedUnprintedCustomer: null,
                isPrinting: false
            });

            handleClearForm(true);

            // Open Print Window
            const printWindow = window.open("", "_blank", "width=800,height=600");
            if (!printWindow) {
                alert("Please allow pop-ups for printing");
                window.location.reload();
                return;
            }

            printWindow.document.write(receiptHtml);
            printWindow.document.close();

            // Auto print and close
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    setTimeout(() => {
                        printWindow.close();
                        window.location.reload();
                    }, 1000);
                }, 100);
            };

        } catch (error) {
            console.error("Printing error:", error);
            alert("මුද්‍රණය කිරීමේදී දෝෂයක් ඇති විය.");
            updateState({ isPrinting: false });
        }
    };
    const handleBillSizeChange = (e) => updateState({ billSize: e.target.value });
    useEffect(() => {
        if (currentUser?.role === 'Admin') {
            console.log("AdminView ref after mount:", adminViewRef.current);
        }
    }, [currentUser]);


    useEffect(() => {
        const handleShortcut = (e) => {
            if (e.key === "F10") {
                e.preventDefault();
                // This reloads the entire page from the server
                window.location.reload();
            }
            if (selectedPrintedCustomer && e.key === "F5") {
                e.preventDefault();
                return;
            }
            if (e.key === "F1") {
                e.preventDefault();
                // Directly call print function without focusing on given amount field
                handlePrintAndClear();
            }
            else if (e.key === "F5") {
                e.preventDefault();
                if (typeof handleMarkAllProcessed === "function") handleMarkAllProcessed();
            }
        };
        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, [displayedSales, newSales, selectedPrintedCustomer, handlePrintAndClear, handleMarkAllProcessed, handleSubmitGivenAmount]);

    //new function to save phone no 
    const savePhoneNumber = async () => {
        const phoneNumber = formData.telephone_no;
        const customerCode = formData.customer_code || autoCustomerCode;

        if (!phoneNumber || !customerCode) {
            alert("Please enter both phone number and customer code");
            return;
        }

        // Validate phone number has exactly 10 digits
        if (phoneNumber.length !== 10 || !/^\d+$/.test(phoneNumber)) {
            alert("Please enter a valid 10-digit phone number");
            return;
        }

        try {
            const response = await api.post('/customers/check-or-create', {
                short_name: customerCode,
                telephone_no: phoneNumber
            });

            if (response.data.customer) {
                // Update the customer name if returned
                setFormData(prev => ({
                    ...prev,
                    customer_name: response.data.customer.name || prev.customer_name
                }));
                // Hide the save button after saving
                updateState({
                    showSavePhoneButton: false,
                    isTelephoneValid: false
                });
            }
        } catch (err) {
            console.error("Failed to save phone number:", err);
            alert("Failed to save phone number. Please try again.");
        }
    };

   const hasData = allSales.length > 0 || customers.length > 0 || items.length > 0 || suppliers.length > 0;
    //context related to bulkupdate
   const ContextMenu = React.memo(({ show, onClose, onUpdate, selectionCriteria, selectedCount }) => {
   const [localCustomerCode, setLocalCustomerCode] = React.useState('');

    React.useEffect(() => {
        if (show) {
            setLocalCustomerCode('');
        }
    }, [show]);

    const handleInputChange = (e) => {
        const value = e.target.value.toUpperCase();
        setLocalCustomerCode(value);
    };

    const handleUpdate = () => {
        if (localCustomerCode.trim()) {
            onUpdate(localCustomerCode.trim().toUpperCase());
            setLocalCustomerCode('');
        } else {
            alert("Please enter a customer code");
        }
    };

    const handleClose = () => {
        setLocalCustomerCode('');
        onClose();
    };

    if (!show) return null;

    return (
        <>
            {/* Backdrop Overlay */}
            <div 
                style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                    backdropFilter: 'blur(4px)', 
                    zIndex: 9999 
                }} 
                onClick={handleClose} 
            />

            {/* Modal Container */}
            <div 
                style={{ 
                    position: 'fixed', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)', 
                    backgroundColor: '#ffffff', 
                    borderRadius: '16px', 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
                    zIndex: 10000, 
                    width: '90%', 
                    maxWidth: '450px', 
                    maxHeight: '90vh', 
                    overflow: 'auto' 
                }} 
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                    @keyframes fadeIn { 
                        from { opacity: 0; } 
                        to { opacity: 1; } 
                    } 
                    .modal-button { 
                        transition: all 0.2s ease; 
                        cursor: pointer; 
                    } 
                    .modal-button:hover { 
                        transform: translateY(-1px); 
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
                    } 
                    .modal-button:active { 
                        transform: translateY(0); 
                    }
                `}</style>

                {/* Header with Icon */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    padding: '12px 20px', 
                    borderTopLeftRadius: '16px', 
                    borderTopRightRadius: '16px', 
                    color: 'white' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            background: 'rgba(255, 255, 255, 0.2)', 
                            borderRadius: '8px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '16px' 
                        }}>
                            ⚡
                        </div>
                        <div>
                            <h2 style={{
                                margin: 0,
                                fontSize: '16px',
                                fontWeight: 'bold',
                                letterSpacing: '-0.5px'
                            }}>
                                Bulk Update Customer
                            </h2>
                            <p style={{
                                margin: '2px 0 0 0',
                                fontSize: '11px',
                                opacity: 0.9
                            }}>
                                Update multiple customer codes at once
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '16px 20px' }}>
                    {/* Selection Criteria Card */}
                    {selectionCriteria && (
                        <div style={{
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            marginBottom: '16px',
                            border: '1px solid #fbbf24'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '8px'
                            }}>
                                <span style={{ fontSize: '14px' }}>📋</span>
                                <span style={{
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    color: '#92400e',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Current Selection
                                </span>
                            </div>

                            <div style={{ display: 'grid', gap: '6px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: 'white',
                                    borderRadius: '6px'
                                }}>
                                    <span style={{ fontSize: '11px', color: '#78350f' }}>Customer:</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        color: '#92400e',
                                        fontFamily: 'monospace'
                                    }}>
                                        {selectionCriteria.customer_code}
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: 'white',
                                    borderRadius: '6px'
                                }}>
                                    <span style={{ fontSize: '11px', color: '#78350f' }}>Item:</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        color: '#92400e',
                                        fontFamily: 'monospace'
                                    }}>
                                        {selectionCriteria.item_code}
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: '#10b981',
                                    borderRadius: '6px',
                                    color: 'white'
                                }}>
                                    <span style={{ fontSize: '11px' }}>Selected:</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        fontSize: '14px'
                                    }}>
                                        {selectedCount || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Input Field */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontWeight: '600',
                            fontSize: '12px',
                            color: '#374151'
                        }}>
                            ✏️ New Customer Code
                        </label>
                        <input
                            type="text"
                            value={localCustomerCode}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleUpdate();
                                }
                            }}
                            style={{ 
                                width: '100%', 
                                padding: '10px 12px', 
                                border: '2px solid #e5e7eb', 
                                borderRadius: '10px', 
                                fontSize: '13px', 
                                fontWeight: '500', 
                                transition: 'all 0.2s ease', 
                                outline: 'none', 
                                boxSizing: 'border-box', 
                                fontFamily: 'monospace' 
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#667eea';
                                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                            }}
                            autoFocus
                            placeholder="e.g., CUST001"
                        />
                    </div>

                    {/* Primary Action Button */}
                    <button
                        onClick={handleUpdate}
                        className="modal-button"
                        style={{ 
                            width: '100%', 
                            padding: '12px', 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '10px', 
                            cursor: 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '14px', 
                            marginBottom: '0' 
                        }}
                    >
                        🚀 Update {selectedCount || 0} Record{selectedCount !== 1 ? 's' : ''}
                    </button>
                </div>

                {/* Footer with Close Button */}
                <div style={{
                    padding: '12px 20px',
                    background: '#f9fafb',
                    borderBottomLeftRadius: '16px',
                    borderBottomRightRadius: '16px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '6px 16px',
                            background: 'transparent',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            color: '#6b7280',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontWeight: '500'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#f3f4f6';
                            e.target.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.borderColor = '#e5e7eb';
                        }}
                    >
                        Cancel (ESC)
                    </button>
                </div>
            </div>
        </>
    );
});
    return (

        <div className="sales-layout" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {isLoading && (<div className="fixed top-0 left-0 right-0 bg-blue-500 text-white py-1 text-center text-sm z-50">Refreshing data...</div>)}
            {state.isPrinting && (<div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black py-1 text-center text-sm z-50">Printing in progress... Please wait</div>)}

            <div className="three-column-layout" style={{ opacity: isLoading ? 0.7 : 1, display: 'grid', gridTemplateColumns: '200px 1fr 200px', gap: '16px', padding: '10px', marginTop: '-149px' }}>
                <div className="left-sidebar" style={{ backgroundColor: '#1ec139ff', borderRadius: '0.75rem', maxHeight: '80.5vh', overflowY: 'auto' }}>

                    {hasData ? (
                        <CustomerList customers={printedCustomers} type="printed" searchQuery={searchQueries.printed} onSearchChange={(value) => updateState({ searchQueries: { ...searchQueries, printed: value } })} selectedPrintedCustomer={selectedPrintedCustomer} selectedUnprintedCustomer={selectedUnprintedCustomer} handleCustomerClick={handleCustomerClick} formatDecimal={formatDecimal} allSales={allSales} lastUpdate={state.forceUpdate || state.windowFocused} isCashFilterActive={state.isCashFilterActive} toggleCashFilter={() => updateState({ isCashFilterActive: !state.isCashFilterActive })} />
                    ) : (
                        <div className="w-full shadow-xl rounded-xl overflow-y-auto border border-black p-4 text-center" style={{ backgroundColor: "#1ec139ff", maxHeight: "80.5vh" }}>
                            <div style={{ backgroundColor: "#006400" }} className="p-1 rounded-t-xl">
                                <h2 className="font-bold text-white mb-1 whitespace-nowrap text-center" style={{ fontSize: '14px' }}>
                                    මුද්‍රණය කළ
                                </h2>
                            </div>
                            <div className="py-4">
                                <p className="text-gray-700">මුද්‍රණය කළ ගනුදෙනු දත්ත නොමැත.</p>
                            </div>
                        </div>
                    )}
                </div>


                <div className="center-form flex flex-col" style={{ backgroundColor: '#111439ff', padding: '20px', borderRadius: '0.75rem', color: 'white', minHeight: '100vh', height: 'auto', boxSizing: 'border-box', gridColumnStart: 2, gridColumnEnd: 3 }}>
                    {currentUser?.role === 'Admin' ? (
                        <AdminView
                            ref={adminViewRef}
                            allSales={allSales}
                            customers={customers}
                            items={items}
                            suppliers={suppliers}
                        />
                    ) : (
                        <div className="pos-sales-view flex flex-col h-full">
                            <div className="flex-shrink-0">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="w-full flex justify-between items-center">
                                        {/* --- TEXT SECTION (Moved Up Independently) --- */}
                                        <div style={{ position: 'relative', top: '-20px', display: 'flex', alignItems: 'center', zIndex: 20 }}>
                                            <div className="font-bold text-lg" style={{ color: 'red', fontSize: '1.35rem' }}>
                                                බිල් අං: {currentBillNo}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '100px' }}>
                                                <div className="font-bold text-xl whitespace-nowrap" style={{ color: 'red', fontSize: '1.15rem' }}>
                                                    මුළු විකුණුම්: Rs. {formatDecimal(totalSalesValue)}
                                                </div>

                                                {/* Bulk Printing Checkbox */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        id="bulkPrintCheckbox"
                                                        checked={state.isBulkPrintEnabled}
                                                        onChange={(e) => updateState({ isBulkPrintEnabled: e.target.checked })}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            cursor: 'pointer',
                                                            accentColor: '#4CAF50'
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor="bulkPrintCheckbox"
                                                        style={{
                                                            color: 'white',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Bulk Printing
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        {/* --- PHOTO SECTION (Stays in original position) --- */}
                                        <div className="flex gap-10 items-center justify-start mt-4 mb-4 relative" style={{ minHeight: '150px' }}>
                                            {/* CUSTOMER PHOTO */}
                                            {state.customerProfilePic && (
                                                <div onClick={() => handleImageClick('customer')}
                                                    className="cursor-pointer hover:scale-105 transition-transform"
                                                    style={{ position: 'absolute', left: '805px', top: '100px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                                                    <span className="text-xs text-gray-400">ගැ</span>
                                                    <div style={{ width: '100px', height: '100px', backgroundColor: 'white', border: '5px solid #1ec139', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                        <img src={state.customerProfilePic} alt="Customer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* SUPPLIER PHOTO */}
                                            {state.supplierProfilePic && (
                                                <div onClick={() => handleImageClick('supplier')}
                                                    className="cursor-pointer hover:scale-105 transition-transform"
                                                    style={{ position: 'absolute', left: '940px', top: '100px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                                    <span className="text-xs text-gray-400">සැ</span>
                                                    <div style={{ width: '100px', height: '100px', backgroundColor: 'white', border: '5px solid #3b82f6', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                        <img src={state.supplierProfilePic} alt="Supplier Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                </div>
                                            )}

                                            <ImagePreviewModal
                                                isOpen={state.isImageModalOpen}
                                                onClose={() => updateState({ isImageModalOpen: false })}
                                                data={state.selectedImageData}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-end gap-3 w-full"
                                        style={{ marginTop: '-160px' }} // Adjust this number until it looks perfect
                                    >
                                        {/* STACK TELEPHONE + CUSTOMER CODE VERTICALLY */}
                                        <div className="flex flex-col gap-2 w-full">
                                            {/* TELEPHONE NUMBER FIELD - Moved up independently using relative positioning */}
                                            <div className="flex-1 min-w-0" style={{ position: 'relative', top: '-50px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input id="telephone_no" ref={refs.telephone_no} name="telephone_no" value={formData.telephone_no || ""} onChange={(e) => handleInputChange("telephone_no", e.target.value)} onKeyDown={(e) => handleKeyDown(e, "telephone_no")} type="tel" maxLength="10" pattern="\d*" placeholder="දුරකථන අංකය (10 ඉලක්කම්)" disabled={!!selectedPrintedCustomer} className="px-2 py-1 font-bold text-sm w-full border rounded text-black placeholder-gray-500" style={{ backgroundColor: selectedPrintedCustomer ? '#4a5568' : '#f6f6ff', border: '1px solid #4a5568', color: 'white', height: '36px', fontSize: '1rem', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box', cursor: selectedPrintedCustomer ? 'not-allowed' : 'text', opacity: selectedPrintedCustomer ? 0.7 : 1, flex: 1 }} />
                                                    {state.showSavePhoneButton && (
                                                        <button
                                                            onClick={savePhoneNumber}
                                                            style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', height: '36px' }}
                                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
                                                            onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
                                                        >
                                                            Save
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* CUSTOMER CODE FIELD - Stays in its original position */}
                                            <div className="flex-1 min-w-0" style={{ marginTop: '-40px' }}>
                                                <input id="customer_code_input" ref={refs.customer_code_input} name="customer_code" value={formData.customer_code || autoCustomerCode} onChange={(e) => handleInputChange("customer_code", e.target.value.toUpperCase())} onKeyDown={(e) => handleKeyDown(e, "customer_code_input")} type="text" placeholder="පාරිභෝගික කේතය" className="px-2 py-1 uppercase font-bold text-sm w-full border rounded bg-white text-black placeholder-gray-500" style={{ backgroundColor: '#0d0d4d', border: '1px solid #4a5568', color: 'white', height: '36px', fontSize: '1rem', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box' }} />
                                            </div>
                                        </div>
                                        <div style={{ flex: '0 0 150px', minWidth: '120px', marginLeft: '-100px' }}>
                                            <Select id="customer_code_select" ref={refs.customer_code_select} value={formData.customer_code ? { value: formData.customer_code, label: `${formData.customer_code}` } : null} onChange={handleCustomerSelect} options={customers.filter(c => !customerSearchInput || c.short_name.charAt(0).toUpperCase() === customerSearchInput.charAt(0).toUpperCase()).map(c => ({ value: c.short_name, label: `${c.short_name}` }))} onInputChange={(v, { action }) => action === "input-change" && updateState({ customerSearchInput: v.toUpperCase() })} inputValue={customerSearchInput} placeholder="පාරිභෝගිකයා තෝරන්න" isClearable isSearchable styles={{ control: b => ({ ...b, minHeight: "36px", height: "36px", fontSize: "25px", backgroundColor: "white", borderColor: "#4a5568", borderRadius: "0.5rem" }), valueContainer: b => ({ ...b, padding: "0 6px", height: "36px" }), placeholder: b => ({ ...b, fontSize: "12px", color: "#a0aec0" }), input: b => ({ ...b, fontSize: "12px", color: "black", fontWeight: "bold" }), singleValue: b => ({ ...b, color: "black", fontSize: "12px", fontWeight: "bold" }), option: (b, s) => ({ ...b, color: "black", fontWeight: "bold", fontSize: "12px", backgroundColor: s.isFocused ? "#e5e7eb" : "white", cursor: "pointer" }) }} />
                                        </div>
                                        <div style={{ flex: '0 0 60px', minWidth: '120px' }}>
                                            <input id="price_per_kg" ref={refs.price_per_kg} name="price_per_kg" type="text" value={formData.price_per_kg} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && handleInputChange('price_per_kg', e.target.value)} onKeyDown={(e) => handleKeyDown(e, "price_per_kg")} placeholder="එකවර මිල" className="px-2 py-1 uppercase font-bold text-sm w-full border rounded bg-white text-black placeholder-gray-500" style={{ backgroundColor: '#0d0d4d', border: '1px solid #4a5568', color: 'white', height: '36px', fontSize: '1rem', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="rounded-lg border relative bg-white flex items-center justify-start pl-2 pt-2.5" style={{ flex: "0 0 100px", marginLeft: "5px", height: "36px" }}>
                                                <span className="absolute left-2 top-1 text-gray-400 text-[10px] pointer-events-none">
                                                    Loan Amount
                                                </span>
                                                <span className="text-black font-bold text-sm">
                                                    Rs. {loanAmount < 0 ? formatDecimal(Math.abs(loanAmount)) : formatDecimal(loanAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", columnGap: "8px", alignItems: "end", marginTop: "8px" }}>
                                        <div style={{ gridColumnStart: 1, gridColumnEnd: 3 }}>
                                            <input id="supplier_code" ref={refs.supplier_code} name="supplier_code" value={formData.supplier_code} onChange={(e) => handleInputChange("supplier_code", e.target.value.toUpperCase())} onKeyDown={(e) => handleKeyDown(e, "supplier_code")} type="text" placeholder="සැපයුම්කරු" className="px-2 py-1 uppercase font-bold text-xs border rounded bg-white text-black placeholder-gray-500 w-full" style={{ width: "150px", backgroundColor: '#0d0d4d', border: '1px solid #4a5568', color: 'white', height: '44px', fontSize: '1.25rem', padding: '0 1rem', borderRadius: '0.5rem', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ gridColumnStart: 5, gridColumnEnd: 7, marginLeft: "-120px", marginRight: "-2px" }}>
                                            {(() => {

                                                const currentFilteredOptions = [...items]
                                                    .filter(item => {
                                                        if (!state.itemSearchInput) return true;
                                                        const input = state.itemSearchInput.toUpperCase();
                                                        return String(item.no).toUpperCase().startsWith(input);
                                                    })
                                                    .sort((a, b) => {
                                                        const isANumeric = !isNaN(a.no);
                                                        const isBNumeric = !isNaN(b.no);
                                                        if (isANumeric && !isBNumeric) return 1;
                                                        if (!isANumeric && isBNumeric) return -1;
                                                        return String(a.no).toUpperCase().localeCompare(String(b.no).toUpperCase());
                                                    })
                                                    .map(item => ({
                                                        value: item.no,
                                                        label: `${item.no} - ${item.type}`,
                                                        item,
                                                    }));

                                                return (
                                                    <Select
                                                        ref={refs.item_code_select}
                                                        openMenuOnFocus={false}
                                                        isSearchable
                                                        tabSelectsValue={false}
                                                        closeMenuOnSelect
                                                        blurInputOnSelect={true}
                                                        inputValue={state.itemSearchInput}
                                                        options={currentFilteredOptions}
                                                        placeholder="භාණ්ඩය"
                                                        defaultMenuIsOpen={false}

                                                        value={
                                                            formData.item_code
                                                                ? {
                                                                    value: formData.item_code,
                                                                    label: `${formData.item_code} - ${formData.item_name}`,
                                                                }
                                                                : null
                                                        }

                                                        onInputChange={(value, meta) => {
                                                            if (meta.action === "input-change") {
                                                                updateState({ itemSearchInput: value.toUpperCase() });
                                                            }
                                                        }}

                                                        onChange={(selectedOption) => {
                                                            if (!selectedOption) return;

                                                            handleItemSelect(selectedOption);
                                                            updateState({ itemSearchInput: "" });

                                                            setTimeout(() => {
                                                                refs.weight.current?.focus();
                                                                refs.weight.current?.select();
                                                            }, 50);
                                                        }}

                                                        onKeyDown={(e) => {
                                                            // 🔥 "+" shortcut for last sale
                                                            if (e.key === "Enter" && state.itemSearchInput === "+") {
                                                                e.preventDefault();
                                                                const lastSale = displayedSales[0];

                                                                if (lastSale) {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        item_code: lastSale.item_code,
                                                                        item_name: lastSale.item_name,
                                                                        pack_due: lastSale.pack_due,
                                                                        price_per_kg: lastSale.price_per_kg
                                                                    }));

                                                                    updateState({
                                                                        itemSearchInput: "",
                                                                        gridPricePerKg: lastSale.price_per_kg || ""
                                                                    });

                                                                    setTimeout(() => {
                                                                        refs.weight.current?.focus();
                                                                        refs.weight.current?.select();
                                                                    }, 50);
                                                                }
                                                                return;
                                                            }

                                                            // 🔥 FIXED: Only auto-select when there's text input AND it's a complete match
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                e.stopPropagation();

                                                                // Don't auto-select if there's no input
                                                                if (!state.itemSearchInput) {
                                                                    // If no input, just move to next field without selecting
                                                                    setTimeout(() => {
                                                                        refs.weight.current?.focus();
                                                                        refs.weight.current?.select();
                                                                    }, 50);
                                                                    return;
                                                                }

                                                                // Check if we have an exact match with the typed input
                                                                const exactMatch = currentFilteredOptions.find(option =>
                                                                    option.value.toUpperCase() === state.itemSearchInput.toUpperCase() ||
                                                                    option.label.toUpperCase().startsWith(state.itemSearchInput.toUpperCase())
                                                                );

                                                                // Only auto-select if we have an exact match
                                                                if (exactMatch) {
                                                                    handleItemSelect(exactMatch);
                                                                    updateState({ itemSearchInput: "" });

                                                                    setTimeout(() => {
                                                                        refs.weight.current?.focus();
                                                                        refs.weight.current?.select();
                                                                    }, 50);
                                                                } else if (state.itemSearchInput && currentFilteredOptions.length === 1) {
                                                                    // If there's exactly one match, select it
                                                                    const firstOption = currentFilteredOptions[0];
                                                                    handleItemSelect(firstOption);
                                                                    updateState({ itemSearchInput: "" });

                                                                    setTimeout(() => {
                                                                        refs.weight.current?.focus();
                                                                        refs.weight.current?.select();
                                                                    }, 50);
                                                                }
                                                                // If no input or multiple options, do nothing - let user choose from dropdown
                                                            }
                                                        }}

                                                        onMenuOpen={() => {
                                                            // When menu opens, ensure no option is pre-highlighted
                                                            setTimeout(() => {
                                                                const menu = document.querySelector('.react-select__menu');
                                                                if (menu) {
                                                                    const firstOption = menu.querySelector('.react-select__option');
                                                                    if (firstOption) {
                                                                        firstOption.classList.remove('react-select__option--is-focused');
                                                                    }
                                                                }
                                                            }, 0);
                                                        }}

                                                        className="react-select-container font-bold text-sm w-full"

                                                        styles={{ control: base => ({ ...base, height: "44px", minHeight: "44px", fontSize: "1.25rem", backgroundColor: "white", borderColor: "#4a5568", borderRadius: "0.5rem" }), valueContainer: base => ({ ...base, padding: "0 1rem", height: "44px" }), input: base => ({ ...base, color: "black", fontSize: "1.25rem" }), singleValue: base => ({ ...base, color: "black", fontWeight: "bold", fontSize: "1.25rem" }), option: (base, state) => ({ ...base, fontWeight: "bold", color: "black", backgroundColor: state.isFocused ? "#e5e7eb" : "white", fontSize: "1rem", ...(state.isSelected && { backgroundColor: "#e5e7eb" }) }), menu: base => ({ ...base, marginTop: "4px" }) }}

                                                        openMenuOnClick={true}
                                                        menuPlacement="auto"
                                                    />
                                                );
                                            })()}
                                        </div>

                                        {[{ id: 'weight', placeholder: "බර", fieldRef: refs.weight },
                                        { id: 'price_per_kg_grid_item', placeholder: "මිල", fieldRef: refs.price_per_kg_grid_item },
                                        { id: 'packs', placeholder: "අසුරුම්", fieldRef: refs.packs },
                                        { id: 'total', placeholder: "TOTAL", fieldRef: refs.total, isReadOnly: true }].map(({ id, placeholder, fieldRef, isReadOnly = false }) => (
                                            <div key={id} style={{ ...(id === 'weight' && { gridColumnStart: 8, gridColumnEnd: 9, marginLeft: "-70px", width: "100px" }), ...(id === 'price_per_kg_grid_item' && { gridColumnStart: 9, gridColumnEnd: 10, marginLeft: "-30px", width: "105px" }), ...(id === 'packs' && { gridColumnStart: 10, gridColumnEnd: 11 }), ...(id === 'total' && { gridColumnStart: 11, gridColumnEnd: 14, marginLeft: "10px" }) }}>
                                                <input id={id} ref={fieldRef} name={id} type="text" value={id === 'price_per_kg_grid_item' ? gridPricePerKg : formData[id]} onChange={(e) => id === 'price_per_kg_grid_item' ? handleInputChange(id, e.target.value) : (/^\d*\.?\d*$/.test(e.target.value) && handleInputChange(id, e.target.value))} onKeyDown={(e) => handleKeyDown(e, id)} placeholder={placeholder} readOnly={isReadOnly} className="px-2 py-1 uppercase font-bold text-xs border rounded bg-white text-black placeholder-gray-500 text-center" style={{ backgroundColor: isReadOnly ? '#e2e8f0' : 'white', borderRadius: '0.5rem', textAlign: 'right', fontSize: '1.125rem', height: '40px', boxSizing: 'border-box', width: '100%' }} />
                                            </div>
                                        ))}
                                    </div>
                                    <button type="submit" style={{ display: "none" }}></button>
                                </form>
                                {errors.form && <div className="mt-6 p-3 bg-red-100 text-red-700 rounded-xl">{errors.form}</div>}
                            </div>
                            <div className="flex-grow overflow-y-auto mt-1">
                                {displayedSales.length === 0 ? (<div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">විකුණුම් වාර්තා කිසිවක් හමු නොවීය.</div>) : (
                                    <table
                                        className="min-w-full border-gray-200 rounded-xl text-sm"
                                        style={{
                                            backgroundColor: '#000000',
                                            color: 'white',
                                            borderCollapse: 'collapse',
                                            margin: '0px 0',
                                            width: '100%',
                                        }}
                                    >
                                        <thead>
                                            <tr style={{ backgroundColor: '#000000' }}>
                                                {/* ❌ Header checkbox removed */}

                                                <th className="px-2 py-2 border" style={{ backgroundColor: '#f5fafb', color: '#000000', width: '40px' }}>
                                                </th>

                                                {['Sup code', 'කේතය', 'අයිතමය', 'බර(kg)', 'මිල', 'අගය', 'මලු', 'Actions'].map((header, index) => (
                                                    <th
                                                        key={index}
                                                        className="px-4 py-2 border"
                                                        style={{ backgroundColor: '#f5fafb', color: '#000000' }}
                                                    >
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {displayedSales.map((s, idx) => {
                                                const isSelected = state.selectedSalesIds.includes(s.id);

                                                return (
                                                    <tr
                                                        key={idx}
                                                        tabIndex={0}
                                                        className={`text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSelected ? 'bg-blue-900' : ''
                                                            }`}
                                                        onClick={() => handleEditClick(s)}
                                                        onContextMenu={(e) => handleRightClick(e, s)}
                                                        style={{ backgroundColor: isSelected ? '#1e40af' : 'transparent' }}
                                                    >
                                                        {/* ✅ Checkbox column (single click works properly) */}
                                                        <td
                                                            className="px-2 py-2 border text-center"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSaleSelection(s.id)} // ✅ fixed
                                                                onClick={(e) => e.stopPropagation()} // ✅ prevents row click
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </td>

                                                        <td className="px-4 py-2 border">{s.supplier_code}</td>
                                                        <td className="px-4 py-2 border">{s.item_code}</td>
                                                        <td className="px-4 py-2 border">{s.item_name}</td>
                                                        <td className="px-2 py-2 border">{formatDecimal(s.weight)}</td>
                                                        <td className="px-2 py-2 border">{formatDecimal(s.price_per_kg)}</td>
                                                        <td className="px-2 py-2 border">
                                                            {formatDecimal(
                                                                (parseFloat(s.weight) || 0) * (parseFloat(s.price_per_kg) || 0) +
                                                                (parseFloat(s.packs) || 0) * (parseFloat(s.pack_due) || 0)
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 border">{s.packs}</td>

                                                        <td className="px-2 py-2 border text-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteRecord(s.id);
                                                                }}
                                                                className="text-black font-bold p-1 rounded-full bg-white hover:bg-gray-200"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                                {/* Context Menu */}

                                <ContextMenu
                                    show={state.bulkUpdateContextMenu.show}
                                    onClose={closeContextMenu}
                                    onUpdate={handleBulkUpdateCustomer}
                                    selectionCriteria={state.selectionCriteria}
                                    selectedCount={state.selectedSalesIds.length}
                                />

                                {/* Click outside to close context menu */}

                                {displayedSales.length > 0 && (<SalesSummaryFooter sales={displayedSales} formatDecimal={formatDecimal} />)}
                                <div
                                    className="flex items-center space-x-3 overflow-x-auto whitespace-nowrap"
                                    style={{ marginTop: "-75px" }}  // adjust value as needed
                                >
                                    <div style={{ marginLeft: '660px', marginTop: '-2px', display: 'none' }}>
                                        <input id="given_amount" ref={refs.given_amount} name="given_amount_field" type="tel" inputMode="numeric" autoComplete="new-password" value={formData.given_amount ? Number(formData.given_amount).toLocaleString() : ""} onChange={(e) => handleInputChange("given_amount", e.target.value.replace(/,/g, ""))} onKeyDown={(e) => handleKeyDown(e, "given_amount")} placeholder="දුන් මුදල" className="px-4 py-2 border rounded-xl text-right bg-white text-black" style={{ width: "180px", fontWeight: "bold", fontSize: "1.1rem" }} />
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start"><ItemSummary sales={displayedSales} formatDecimal={formatDecimal} /><BreakdownDisplay sale={selectedSaleForBreakdown} formatDecimal={formatDecimal} /></div>
                                <div className="flex items-center justify-between mb-4" style={{ marginTop: "35px" }}>
                                    {/* Red Total Text */}
                                    <div className="flex items-center justify-between mb-4" style={{ marginTop: "35px" }}>
                                        {displayedSales.length > 0 && (
                                            <div className="flex items-center justify-between mb-4" style={{ marginTop: "35px" }}>
                                                {/* Red Total Text */}
                                                <div className="flex items-center justify-between mb-4" style={{ marginTop: "35px" }}>
                                                    <div className="text-2xl font-bold" style={{ color: 'red' }}>
                                                        (විකුණුම්: Rs. {formatDecimal(salesTotal)} + මල්ලක අගය: Rs. {formatDecimal(packCostTotal)} )
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="right-sidebar" style={{ backgroundColor: '#1ec139ff', borderRadius: '0.75rem', maxHeight: '80.5vh', overflowY: 'auto', gridColumnStart: 3, gridColumnEnd: 4 }}>
                    {hasData ? (<CustomerList customers={unprintedCustomers} type="unprinted" searchQuery={searchQueries.unprinted} onSearchChange={(value) => updateState({ searchQueries: { ...searchQueries, unprinted: value } })} selectedPrintedCustomer={selectedPrintedCustomer} selectedUnprintedCustomer={selectedUnprintedCustomer} handleCustomerClick={handleCustomerClick} formatDecimal={formatDecimal} allSales={allSales} lastUpdate={state.forceUpdate || state.windowFocused} />) : (
                        <div className="w-full shadow-xl rounded-xl overflow-y-auto border border-black p-4 text-center" style={{ backgroundColor: "#1ec139ff", maxHeight: "80.5vh" }}>
                            <div style={{ backgroundColor: "#006400" }} className="p-1 rounded-t-xl"><h2 className="font-bold text-white mb-1 whitespace-nowrap text-center" style={{ fontSize: '14px' }}>මුද්‍රණය නොකළ</h2></div><div className="py-4"><p className="text-gray-700">මුද්‍රණය නොකළ විකුණුම් කිසිවක් සොයාගත නොහැක</p></div>
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
}