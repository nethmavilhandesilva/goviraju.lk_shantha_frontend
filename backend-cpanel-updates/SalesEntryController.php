<?php

namespace App\Http\Controllers;

use App\Mail\DayEndWeightReportMail;
use App\Models\Bank;
use App\Models\Debtor;
use App\Models\GrnEntry;
use App\Models\Supplier;
use App\Models\Sale;
use App\Models\Item;
use App\Models\Customer;
use App\Models\SupplierLoan;
use App\Models\SupplierLoanHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log; // Make sure Log is imported
use App\Models\Salesadjustment;
use App\Models\SalesHistory;
use Carbon\Carbon;
use App\Models\Setting;
use App\Models\CustomersLoan;
use Illuminate\Http\JsonResponse;
use App\Models\Commission;
use Illuminate\Support\Str;
use Twilio\Rest\Client;
use TextLK\SMS\TextLKSMSMessage;
use Illuminate\Support\Facades\Mail;
use App\Models\SupplierBillNumber;
use Illuminate\Support\Facades\Schema;
/*
    SalesEntryController handles CRUD operations for sales entries,
    including complex logic for commission calculation, price updates,
    and maintaining sales adjustment history.
*/
class SalesEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $currentUser = auth()->user();

            Log::info('SalesEntryController@index called', [
                'db_id' => $currentUser?->id,
                'user_id' => $currentUser?->user_id, // This is the important one!
                'name' => $currentUser?->name,
                'role' => $currentUser?->role,
            ]);

            // Base query
            $query = Sale::with(['customer']);

            // Apply User filter
            if ($currentUser && $currentUser->role === 'User') {
                // Filter by user_id field (which should be 'pos12345')
                $query->where('UniqueCode', $currentUser->user_id);
            }

            $sales = $query->get();

            Log::info('SalesEntryController@index: Query successful', [
                'total_sales' => $sales->count(),
                'filtered_by' => $currentUser?->role === 'User' ? $currentUser->user_id : 'none',
                'matching_records_found' => $sales->where('UniqueCode', $currentUser?->user_id)->count(),
            ]);

            $printedSales = $sales->where('bill_printed', 'Y')->values();
            $unprintedSales = $sales->where('bill_printed', 'N')->values();

            return response()->json([
                'sales' => $sales,
                'printed_sales' => $printedSales,
                'unprinted_sales' => $unprintedSales,
            ]);

        } catch (\Exception $e) {
            Log::error('SalesEntryController@index FAILED', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch sales data.'
            ], 500);
        }
    }
    public function create()
    {
        $suppliers = Supplier::all();
        $items = GrnEntry::select('item_name', 'item_code', 'code')
            ->where('is_hidden', 0) // Add the condition here
            ->distinct()
            ->get();
        $entries = GrnEntry::where('is_hidden', 0)->get();

        // Fetch all items with pack_cost to create a lookup array
        $itemsWithPackCost = Item::select('no', 'pack_due')->get();
        $itemPackCosts = [];
        foreach ($itemsWithPackCost as $item) {
            $itemPackCosts[$item->no] = $item->pack_due;
        }

        // Fetch ALL sales records to display
        $sales = Sale::where('Processed', 'N')->get();

        // Add pack_cost to each sale
        foreach ($sales as $sale) {
            $sale->pack_due = $itemPackCosts[$sale->item_code] ?? 0;
        }

        $customers = Customer::all();
        $totalSum = $sales->sum('total'); // Sum will now be for all displayed sales

        $unprocessedSales = Sale::whereIn('Processed', ['Y', 'N']) // Include both processed and unprocessed
            ->get();

        // Add pack_cost to each unprocessed sale
        foreach ($unprocessedSales as $sale) {
            $sale->pack_due = $itemPackCosts[$sale->item_code] ?? 0;
        }

        $salesPrinted = Sale::where('bill_printed', 'Y')
            ->orderBy('created_at', 'desc')
            ->orderBy('bill_no') // Or ->orderBy('created_at') for chronological order
            ->get()
            ->groupBy('customer_code');

        // Add pack_cost to each printed sale
        foreach ($salesPrinted as $customerSales) {
            foreach ($customerSales as $sale) {
                $sale->pack_due = $itemPackCosts[$sale->item_code] ?? 0;
            }
        }

        $totalUnprocessedSum = $unprocessedSales->sum('total');

        $salesNotPrinted = Sale::where('bill_printed', 'N')
            ->orderBy('customer_code')
            ->get()
            ->groupBy('customer_code');

        // Add pack_cost to each not printed sale
        foreach ($salesNotPrinted as $customerSales) {
            foreach ($customerSales as $sale) {
                $sale->pack_due = $itemPackCosts[$sale->item_code] ?? 0;
            }
        }

        $billDate = Setting::value('value');

        // Calculate total for unprocessed sales
        $totalUnprintedSum = Sale::where('bill_printed', 'N')->sum('total');

        $lastDayStartedSetting = Setting::where('key', 'last_day_started_date')->first();
        $lastDayStartedDate = $lastDayStartedSetting ? Carbon::parse($lastDayStartedSetting->value) : null;

        $nextDay = $lastDayStartedDate ? $lastDayStartedDate->addDay() : Carbon::now();

        $codes = Sale::select('code')
            ->distinct()
            ->orderBy('code')
            ->get();

        // Create salesArray with pack_cost for JavaScript
        $salesArray = Sale::all();
        foreach ($salesArray as $sale) {
            $sale->pack_due = $itemPackCosts[$sale->item_code] ?? 0;
        }

        return view('dashboard', compact(
            'suppliers',
            'items',
            'entries',
            'sales',
            'customers',
            'totalSum',
            'unprocessedSales',
            'salesPrinted',
            'totalUnprocessedSum',
            'salesNotPrinted',
            'totalUnprintedSum',
            'nextDay',
            'codes',
            'billDate',
            'salesArray',
            'itemsWithPackCost'
        ));
    }
 public function store(Request $request)
{
    $validated = $request->validate([
        'supplier_code' => 'required|string|max:255',
        'customer_code' => 'required|string|max:255',
        'customer_name' => 'nullable|string|max:255',
        'item_code' => 'required|string|exists:items,no',
        'item_name' => 'required|string|max:255',
        'weight' => 'required|numeric',
        'price_per_kg' => 'required|numeric',
        'pack_due' => 'nullable|numeric',
        'total' => 'required|numeric',
        'packs' => 'required|numeric',
        'given_amount' => 'nullable|numeric',
        'bill_no' => 'nullable|string|max:255',
        'bill_printed' => 'nullable|string|in:N,Y',
    ]);

    try {
        DB::beginTransaction();

        // 1. Fetch Item details
        $item = Item::where('no', $validated['item_code'])->first();
        if (!$item) {
            return response()->json(['error' => 'Item not found.'], 422);
        }

        // --- CALCULATION LOGIC ---
        $bagWeightPerUnit = (float) ($item->bag_real_price ?? 0);
        $numPacks = (int) $validated['packs'];
        $pricePerKg = (float) $validated['price_per_kg'];

        // Total Bag Weight to subtract
        $totalBagWeight = $bagWeightPerUnit * $numPacks;

        // Net Weight for this specific entry
        $incomingNetWeight = (float) $validated['weight'] - $totalBagWeight;

        // Recalculate Total based on Net Weight (Price * Net Weight)
        // If price is 0 (unpriced items), total remains 0.
        $recalculatedIncomingTotal = $incomingNetWeight * $pricePerKg;
        // -------------------------

        $billPrinted = $validated['bill_printed'] ?? null;
        $currentEntry = [
            'time' => now('Asia/Colombo')->format('h:i A'),
            'weight' => (float) $validated['weight'],
            'packs' => $numPacks
        ];

        $shouldCheckForUpdate =
            ($billPrinted === null || $billPrinted === 'N') &&
            $pricePerKg == 0;

        if ($shouldCheckForUpdate) {
            // NOTE: relies on the idx_sales_unpriced_lookup composite index
            // (customer_code, item_code, supplier_code, price_per_kg, Processed) —
            // see migration 2025_06_01_000000_add_performance_indexes_to_sales_table.
            // Ordering by 'id' instead of 'created_at' lets this use the primary
            // key for the sort instead of an extra filesort on every insert.
            $existingSale = Sale::where('customer_code', strtoupper($validated['customer_code']))
                ->where('item_code', $validated['item_code'])
                ->where('supplier_code', $validated['supplier_code'])
                ->where(function ($query) {
                    $query->where('bill_printed', 'N')->orWhereNull('bill_printed');
                })
                ->where('price_per_kg', 0)
                ->where('Processed', 'N')
                ->orderBy('id', 'desc')
                ->first();

            if ($existingSale) {
                $newWeight = $existingSale->weight + $incomingNetWeight;
                $newPacks = $existingSale->packs + $numPacks;

                // Since price_per_kg is 0 for these updates, total remains 0
                $newTotal = $newWeight * 0;

                $history = $existingSale->breakdown_history;
                if (is_string($history)) {
                    $history = json_decode($history, true);
                }
                if (!is_array($history)) {
                    $history = [['time' => $existingSale->created_at->format('h:i A'), 'weight' => (float) $existingSale->weight, 'packs' => (int) $existingSale->packs]];
                }
                $history[] = $currentEntry;

                $existingSale->update([
                    'weight' => $newWeight,
                    'packs' => $newPacks,
                    'total' => $newTotal, // Updated Total
                    'SupplierTotal' => 0,
                    'profit' => 0,
                    'breakdown_history' => $history,
                    'bag_real_weight' => $bagWeightPerUnit,
                    'updated_at' => now(),
                ]);

                DB::commit();
                return response()->json(['success' => true, 'message' => 'Existing record updated', 'data' => $existingSale->fresh()]);
            }
        }

        // ---------- REMOVED COMMISSION LOGIC ----------

        $customerPackCost = $item->pack_cost ?? 0;
        $customerPackLabour = $item->pack_due ?? 0;

        // Final calculations for NEW sale
        $supplierTotal = $incomingNetWeight * $pricePerKg;
        $profit = $recalculatedIncomingTotal - $supplierTotal;

        $settingDate = Setting::value('value') ?? now()->toDateString();

        // ---------- CREATE NEW SALE ----------
        $sale = Sale::create([
            'supplier_code' => $validated['supplier_code'],
            'customer_code' => strtoupper($validated['customer_code']),
            'customer_name' => $validated['customer_name'],
            'item_code' => $validated['item_code'],
            'item_name' => $validated['item_name'],
            'weight' => $incomingNetWeight,
            'price_per_kg' => $pricePerKg,
            'pack_due' => $validated['pack_due'] ?? 0,
            'total' => $recalculatedIncomingTotal, // RECALCULATED TOTAL HERE
            'packs' => $numPacks,
            'CustomerPackCost' => $customerPackCost,
            'CustomerPackLabour' => $customerPackLabour,
            'SupplierWeight' => $incomingNetWeight,
            'SupplierPricePerKg' => $pricePerKg,
            'SupplierTotal' => $supplierTotal,
            'SupplierPackCost' => $customerPackCost,
            'SupplierPackLabour' => $customerPackLabour,
            'profit' => $profit,
            'breakdown_history' => [$currentEntry],
            'Processed' => 'N',
            'CustomerBillEnteredOn' => now(),
            'UniqueCode' => auth()->user()->user_id,
            'Date' => $settingDate,
            'ip_address' => $request->ip(),
            'given_amount' => $validated['given_amount'],
            'bill_printed' => $billPrinted,
            'bill_no' => $validated['bill_no'] ?? null,
            'commission_amount' => 0, // Set to 0 as default
            'bag_real_weight' => $bagWeightPerUnit,
        ]);

        DB::commit();
        return response()->json(['success' => true, 'message' => 'New record created with updated total', 'data' => $sale->fresh()]);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Sales Entry Failed: ' . $e->getMessage());
        return response()->json(['error' => 'Failed: ' . $e->getMessage()], 422);
    }
}
    public function markAllAsProcessed(Request $request)
    {
        try {
            DB::beginTransaction();

            Sale::where('Processed', 'N')->update([
                'Processed' => 'Y',
                'bill_printed' => DB::raw("IFNULL(bill_printed, 'N')") // Set to 'N' only if currently NULL
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'All sales with Processed = N are now marked as processed, and NULL bill_printed values set to N.'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            \Log::error('Error marking all sales as processed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to mark sales as processed: ' . $e->getMessage()
            ], 500);
        }
    }

public function markAsPrinted(Request $request)
{
    Log::info('markAsPrinted Request Data:', $request->all());

    $salesIds = $request->input('sales_ids');
    if (empty($salesIds)) {
        return response()->json(['status' => 'error', 'message' => 'No sales IDs provided.'], 400);
    }

    try {
        DB::beginTransaction();

        // 1. HANDLE CUSTOMER BILL NUMBER GENERATION
        $existingBillNo = Sale::whereIn('id', $salesIds)
            ->where('processed', 'Y')
            ->whereNotNull('bill_no')
            ->first()?->bill_no;

        $customerBillNo = $existingBillNo ?: $this->generateNewBillNumber();

        $salesRecords = null;

        // 2. UPDATE ONLY CUSTOMER BILL INFORMATION (NO SUPPLIER)
        DB::transaction(function () use ($salesIds, $customerBillNo, &$salesRecords) {

            $salesRecords = Sale::whereIn('id', $salesIds)->get();

            foreach ($salesRecords as $sale) {
                // Customer bill updates only
                if ($sale->bill_printed === 'Y') {
                    $sale->BillReprintAfterChanges = now();
                }
                $sale->bill_printed = 'Y';
                $sale->processed = 'Y';
                $sale->bill_no = $customerBillNo;
                $sale->FirstTimeBillPrintedOn = $sale->FirstTimeBillPrintedOn ?? now();

                $sale->save();
            }
        });

        // 3. GENERATE CUSTOMER BILL SUMMARY
        $itemsForSummary = Sale::whereIn('id', $salesIds)->get();

        $billFinalTotal = $itemsForSummary->sum(function ($item) {
            return (float) $item->total + (float) $item->CustomerPackCost;
        });

        $summaryString = $itemsForSummary->groupBy('item_code')->map(function ($group) {
            $itemName = $group->first()->item_name;
            $itemCode = $group->first()->item_code;
            $totalWeight = $group->sum('weight');
            $totalPacks = $group->sum('packs');
            return "{$itemName}({$itemCode})={$totalWeight}/{$totalPacks}";
        })->implode("\n");

        // 4. PREPARE SALES DATA FOR CUSTOMER BILL
        $formattedSalesData = [];
        foreach ($salesRecords as $sale) {
            $formattedSalesData[] = [
                'id' => $sale->id,
                'item_name' => $sale->item_name,
                'item_code' => $sale->item_code,
                'weight' => (float) $sale->weight,
                'price_per_kg' => (float) $sale->price_per_kg,
                'packs' => (int) $sale->packs,
                'supplier_code' => $sale->supplier_code,
                'customer_code' => $sale->customer_code,
                'total' => (float) $sale->total,
                'SupplierTotal' => (float) $sale->SupplierTotal,
                'SupplierPricePerKg' => (float) $sale->SupplierPricePerKg,
                'CustomerPackCost' => (float) ($sale->CustomerPackCost ?? 0),
                'commission_amount' => (float) ($sale->commission_amount ?? 0),
            ];
        }

        // 5. CREATE CUSTOMER BILL PUBLIC LINK (NO SUPPLIER LINK)
        $customerToken = Str::random(40);
        $baseUrl = env('APP_FRONTEND_URL', 'https://wday.lk/pos_frontend_90500/');
        $customerPublicUrl = rtrim($baseUrl, '/') . "/view-bill/" . $customerToken;

        DB::table('bill_links')->insert([
            'token' => $customerToken,
            'bill_no' => $customerBillNo,
            'sales_data' => json_encode($formattedSalesData),
            'loan_amount' => $request->loan_amount ?? 0,
            'customer_name' => $request->customer_name,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        DB::commit();

        // 6. SEND ONLY CUSTOMER SMS (NO SUPPLIER SMS)
        $customerTo = $this->resolveCustomerTelephone($request, $salesRecords);
        if (!empty($customerTo)) {
            $this->sendCustomerSMS($customerTo, $request->customer_code ?? $salesRecords->first()->customer_code,
                $customerBillNo, $summaryString, $billFinalTotal, $customerPublicUrl);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Sales processed with customer bill!',
            'customer_bill_no' => $customerBillNo,
            'customer_bill_link' => $customerPublicUrl
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('markAsPrinted Failed:', ['error' => $e->getMessage()]);
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to update records: ' . $e->getMessage()
        ], 500);
    }
}
private function resolveCustomerTelephone($request, $salesRecords)
{
    $to = $request->telephone_no_customer ?? null;
    $customerCode = $request->customer_code ?? $request->customer_name ?? ($salesRecords->first()->customer_code ?? null);

    if (empty($to) && !empty($customerCode)) {
        $customer = Customer::where('short_name', $customerCode)->first();
        if ($customer) {
            $to = $customer->telephone_no;
        }
    }

    return $to;
}

// Helper method to send customer SMS
private function sendCustomerSMS($to, $customerCode, $billNo, $summaryString, $billFinalTotal, $publicUrl)
{
    try {
        $to = preg_replace('/[^0-9]/', '', $to);
        if (str_starts_with($to, '0')) {
            $to = '94' . substr($to, 1);
        }

        $messageBody = "Customer Bill,\n" .
            "Hello {$customerCode},\n" .
            "Bill #{$billNo} Summary:\n" .
            "{$summaryString}\n" .
            "Bill Final Total: " . number_format($billFinalTotal, 2) . "\n" .
            "View: {$publicUrl}";

        $textLKSMS = new TextLKSMSMessage();
        $result = $textLKSMS->recipient($to)
            ->message($messageBody)
            ->senderId(env('TEXTLK_SENDER_ID', 'TextLKDemo'))
            ->apiKey(env('TEXTLK_API_KEY'))
            ->send();

        Log::info("Customer SMS sent successfully to: " . $to);
    } catch (\Exception $e) {
        Log::error("Customer SMS failed: " . $e->getMessage());
    }
}

// Helper method to send supplier SMS
private function sendSupplierSMS($to, $supplierCode, $billNo, $salesRecords, $token, $advanceAmount)
{
    try {
        // Calculate supplier totals
        $supplierTotal = $salesRecords->sum('SupplierTotal');
        $totalPacks = $salesRecords->sum('packs');

        $to = preg_replace('/[^0-9]/', '', $to);
        if (str_starts_with($to, '0')) {
            $to = '94' . substr($to, 1);
        }

        $baseUrl = env('APP_FRONTEND_URL', 'https://goviraju.lk/sms_new_frontend_50500/');
        $publicUrl = rtrim($baseUrl, '/') . "/view-supplier-bill/" . $token;

        $messageBody = "Supplier Bill,\n" .
            "Hello {$supplierCode},\n" .
            "Bill #{$billNo}\n" .
            "Total Amount: " . number_format($supplierTotal, 2) . "\n" .
            "Total Packs: {$totalPacks}\n" .
            "Advance Amount: " . number_format($advanceAmount, 2) . "\n" .
            "View: {$publicUrl}";

        $textLKSMS = new TextLKSMSMessage();
        $result = $textLKSMS->recipient($to)
            ->message($messageBody)
            ->senderId(env('TEXTLK_SENDER_ID', 'TextLKDemo'))
            ->apiKey(env('TEXTLK_API_KEY'))
            ->send();

        Log::info("Supplier SMS sent successfully to: " . $to);
    } catch (\Exception $e) {
        Log::error("Supplier SMS failed: " . $e->getMessage());
    }
}
    private function generateNewBillNumber()
    {
        return \DB::transaction(function () {
            $bill = \App\Models\BillNumber::lockForUpdate()->first();
            if (!$bill) {
                $bill = \App\Models\BillNumber::create(['last_bill_no' => 999]);
            }
            $bill->last_bill_no += 1;
            $bill->save();
            return $bill->last_bill_no;
        });
    }

    public function update(Request $request, Sale $sale)
    {
        // --- 1. Validation ---
        $validatedData = $request->validate([
            'customer_code' => 'required|string|max:255',
            'customer_name' => 'nullable|string|max:255',
            'supplier_code' => 'nullable|string|max:255',
            'item_code' => 'required|string|max:255',
            'item_name' => 'required|string|max:255',
            'weight' => 'required|numeric|min:0',
            'price_per_kg' => 'required|numeric|min:0',
            'pack_due' => 'nullable|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'packs' => 'required|integer|min:0',
            'given_amount' => 'nullable|numeric|min:0',
            'bill_no' => 'nullable|string|max:255',
            'bill_printed' => 'nullable|string|in:N,Y',
            'update_related_price' => 'nullable|boolean',
        ]);

        DB::beginTransaction();
        $affectedSales = [];

        // Capture original data BEFORE any updates
        $originalData = $sale->toArray();

        try {
            $settingDate = Setting::value('value');
            $formattedDate = \Carbon\Carbon::parse($settingDate)->format('Y-m-d');

            $newPricePerKg = $validatedData['price_per_kg'];
            $commissionAmount = 0.00;

            // --- 2. Fetch Fresh Item Data ---
            $item = Item::where('no', $validatedData['item_code'])->first();
            if (!$item) {
                throw new \Exception('Item not found for calculation.');
            }

            $newBagPrice = (float) ($item->pack_cost ?? 0);

            // --- 3. Commission Rule Logic ---
            $commissionRule = Commission::where('item_code', $validatedData['item_code'])
                ->where('starting_price', '<=', $newPricePerKg)
                ->where('end_price', '>=', $newPricePerKg)
                ->orWhere(function ($query) use ($validatedData, $sale, $newPricePerKg) {
                    $query->where('supplier_code', $validatedData['supplier_code'] ?? $sale->supplier_code)
                        ->where('starting_price', '<=', $newPricePerKg)
                        ->where('end_price', '>=', $newPricePerKg);
                })
                ->orWhere(function ($query) use ($newPricePerKg) {
                    $query->where('type', 'Z')
                        ->where('starting_price', '<=', $newPricePerKg)
                        ->where('end_price', '>=', $newPricePerKg);
                })
                ->first();

            if ($commissionRule) {
                $commissionAmount = $commissionRule->commission_amount;
            }

            // --- 4. Main Record Calculations ---
            $supplierPricePerKg = abs($newPricePerKg - $commissionAmount);
            $newSupplierTotal = $validatedData['weight'] * $supplierPricePerKg;
            $newTotal = ($validatedData['weight'] * $newPricePerKg) + ($validatedData['packs'] * $newBagPrice);
            $newProfit = $newTotal - $newSupplierTotal;

            // --- 5. Track Original for Adjustment Logs (Only if Printed) ---
            if ($originalData['bill_printed'] === 'Y') {
                Salesadjustment::create([
                    'customer_code' => $originalData['customer_code'],
                    'supplier_code' => $originalData['supplier_code'] ?? null,
                    'code' => $originalData['item_code'],
                    'item_code' => $originalData['item_code'],
                    'item_name' => $originalData['item_name'],
                    'weight' => $originalData['weight'],
                    'price_per_kg' => $originalData['price_per_kg'],
                    'pack_due' => $originalData['pack_due'] ?? 0,
                    'total' => $originalData['total'],
                    'packs' => $originalData['packs'],
                    'bill_no' => $originalData['bill_no'],
                    'user_id' => 'c11',
                    'type' => 'original',
                    'original_created_at' => \Carbon\Carbon::parse($sale->Date)
                        ->setTimeFrom(\Carbon\Carbon::parse($sale->created_at))
                        ->format('Y-m-d H:i:s'),
                    'original_updated_at' => $sale->updated_at,
                    'Date' => $formattedDate,
                ]);
            }

            // --- 6. Update Main Sale Record ---
            $sale->update([
                'customer_code' => $validatedData['customer_code'],
                'customer_name' => $validatedData['customer_name'] ?? $sale->customer_name,
                'code' => $validatedData['item_code'],
                'supplier_code' => $validatedData['supplier_code'] ?? $sale->supplier_code,
                'item_code' => $validatedData['item_code'],
                'item_name' => $validatedData['item_name'],
                'weight' => $validatedData['weight'],
                'packs' => $validatedData['packs'],
                'price_per_kg' => $newPricePerKg,
                'commission_amount' => $commissionAmount,
                'SupplierPricePerKg' => $supplierPricePerKg,
                'SupplierTotal' => $newSupplierTotal,
                'pack_due' => $newBagPrice,
                'CustomerPackLabour' => $newBagPrice,
                'CustomerPackCost' => $newBagPrice,
                'total' => $newTotal,
                'profit' => $newProfit,
                'given_amount' => $validatedData['given_amount'] ?? $sale->given_amount,
                'bill_no' => $validatedData['bill_no'] ?? $sale->bill_no,
                'bill_printed' => $validatedData['bill_printed'] ?? $sale->bill_printed,
                'updated' => 'Y',
                'BillChangedOn' => now(),
            ]);

            // --- 7. Bulk Update Logic ---
            if ($request->input('update_related_price') === true) {
                $customerCode = $validatedData['customer_code'];
                $itemCode = $validatedData['item_code'];
                $supplierCode = $validatedData['supplier_code'] ?? $sale->supplier_code;

                $updateQuery = Sale::where('customer_code', $customerCode)
                    ->where('item_code', $itemCode)
                    ->where('supplier_code', $supplierCode)
                    ->where('id', '!=', $sale->id);

                if ($sale->bill_printed === 'Y' && $sale->bill_no) {
                    $updateQuery->where('bill_printed', 'Y')->where('bill_no', $sale->bill_no);
                } else {
                    $updateQuery->where(function ($query) {
                        $query->where('bill_printed', 'N')->orWhereNull('bill_printed');
                    });
                }

                $updateQuery->update([
                    'item_code' => $itemCode,
                    'item_name' => $validatedData['item_name'],
                    'price_per_kg' => $newPricePerKg,
                    'commission_amount' => $commissionAmount,
                    'SupplierPricePerKg' => $supplierPricePerKg,
                    'pack_due' => $newBagPrice,
                    'CustomerPackLabour' => $newBagPrice,
                    'CustomerPackCost' => $newBagPrice,
                    'total' => DB::raw("weight * $newPricePerKg + packs * $newBagPrice"),
                    'SupplierTotal' => DB::raw("weight * $supplierPricePerKg"),
                    'profit' => DB::raw("(weight * $newPricePerKg + packs * $newBagPrice) - (weight * $supplierPricePerKg)"),
                    'updated' => 'Y',
                ]);

                $affectedSales = Sale::where('customer_code', $customerCode)
                    ->where('item_code', $itemCode)
                    ->where('supplier_code', $supplierCode);

                if ($sale->bill_printed === 'Y' && $sale->bill_no) {
                    $affectedSales->where('bill_printed', 'Y')->where('bill_no', $sale->bill_no);
                } else {
                    $affectedSales->where(function ($query) {
                        $query->where('bill_printed', 'N')->orWhereNull('bill_printed');
                    });
                }
                $affectedSales = $affectedSales->get();
            } else {
                $affectedSales = collect([$sale->fresh()]);
            }

            // --- 8. Finalize Adjustments & Stock ---
            // Only recompute remaining stock for the item that actually changed.
            $this->updateGrnRemainingStock($validatedData['item_code']);

            if ($originalData['bill_printed'] === 'Y') {
                $newData = $sale->fresh();
                Salesadjustment::create([
                    'customer_code' => $newData['customer_code'],
                    'supplier_code' => $newData['supplier_code'] ?? null,
                    'code' => $newData['item_code'],
                    'item_code' => $newData['item_code'],
                    'item_name' => $newData['item_name'],
                    'weight' => $newData['weight'],
                    'price_per_kg' => $newData['price_per_kg'],
                    'pack_due' => $newData['pack_due'] ?? 0,
                    'total' => $newData['total'],
                    'packs' => $newData['packs'],
                    'bill_no' => $newData['bill_no'],
                    'user_id' => 'c11',
                    'type' => 'updated',
                    'original_created_at' => \Carbon\Carbon::parse($sale->Date)
                        ->setTimeFrom(\Carbon\Carbon::parse($sale->created_at))
                        ->format('Y-m-d H:i:s'),
                    'original_updated_at' => $sale->updated_at,
                    'Date' => $formattedDate,
                ]);
            }

            DB::commit();
            return response()->json(['success' => true, 'sales' => $affectedSales->toArray()]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update sales record: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Sale $sale)
    {
        try {
            // 1. Get setting date safely
            $settingDate = Setting::value('value') ?? now();
            $formattedDate = Carbon::parse($settingDate)->format('Y-m-d');

            // Check if the bill was printed to handle adjustments and SMS
            if ($sale->bill_printed === 'Y') {

                // --- A. Log to Salesadjustment Table ---
                $adjustmentData = [
                    'customer_code' => $sale->customer_code,
                    'supplier_code' => $sale->supplier_code,
                    'code' => $sale->item_code,
                    'item_code' => $sale->item_code,
                    'item_name' => $sale->item_name,
                    'weight' => $sale->weight,
                    'price_per_kg' => $sale->price_per_kg,
                    'total' => $sale->total,
                    'packs' => $sale->packs,
                    'bill_no' => $sale->bill_no,
                    'original_created_at' => $sale->created_at,
                    'Date' => $formattedDate,
                ];

                Salesadjustment::create($adjustmentData + ['type' => 'original']);
                Salesadjustment::create($adjustmentData + ['type' => 'deleted']);

            }

            // 2. Perform actual deletion and update stock
            $saleCode = $sale->code;
            $sale->delete();
            // Only recompute remaining stock for the item that was deleted.
            $this->updateGrnRemainingStock($saleCode);

            return response()->json([
                'success' => true,
                'message' => 'Sales record deleted successfully.'
            ]);

        } catch (\Exception $e) {
            Log::error('Error deleting sale', [
                'sale_id' => $sale->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while deleting the sale.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Recompute GrnEntry remaining packs/weight for one item code (or, when no
     * code is given, every code). Uses SQL aggregation (SUM) and one bulk
     * UPDATE per code instead of loading the entire grn_entries / sales /
     * sales_histories tables into PHP memory and saving row-by-row — the
     * previous version's cost scaled with total historical data and got
     * slower every time a record was edited or deleted.
     */
    public function updateGrnRemainingStock(?string $code = null): void
    {
        $codes = $code !== null
            ? [$code]
            : GrnEntry::select('code')->distinct()->pluck('code')->all();

        foreach ($codes as $grnCode) {
            if ($grnCode === null || $grnCode === '') {
                continue;
            }

            $grnTotals = GrnEntry::where('code', $grnCode)
                ->selectRaw('
                    COALESCE(SUM(original_packs), 0) as total_original_packs,
                    COALESCE(SUM(original_weight), 0) as total_original_weight,
                    COALESCE(SUM(wasted_packs), 0) as total_wasted_packs,
                    COALESCE(SUM(wasted_weight), 0) as total_wasted_weight
                ')
                ->first();

            $soldPacks = (float) Sale::where('code', $grnCode)->sum('packs')
                + (float) SalesHistory::where('code', $grnCode)->sum('packs');
            $soldWeight = (float) Sale::where('code', $grnCode)->sum('weight')
                + (float) SalesHistory::where('code', $grnCode)->sum('weight');

            $remainingPacks = max(
                (float) $grnTotals->total_original_packs - $soldPacks - (float) $grnTotals->total_wasted_packs,
                0
            );
            $remainingWeight = max(
                (float) $grnTotals->total_original_weight - $soldWeight - (float) $grnTotals->total_wasted_weight,
                0
            );

            GrnEntry::where('code', $grnCode)->update([
                'packs' => $remainingPacks,
                'weight' => $remainingWeight,
            ]);
        }
    }


    public function saveAsUnprinted(Request $request)
    {

        $validated = $request->validate([
            'sale_ids' => 'required|array',
            'sale_ids.*' => 'integer|exists:sales,id', // Check that each ID exists
        ]);

        if (!empty($validated['sale_ids'])) {
            Sale::whereIn('id', $validated['sale_ids'])->update(['is_printed' => 0]);
        }

        return response()->json(['success' => true]);
    }

    public function getUnprintedSales($customer_code)
    {
        $sales = Sale::where('customer_code', $customer_code)
            ->where('bill_printed', 'N')
            ->get();

        // Return the sales records as a JSON response
        return response()->json($sales);
    }
    public function getAllSalesData()
    {
        try {
            // Fetch all sales records from the database
            $allSales = Sale::all();

            // Return the sales records as a JSON response
            return response()->json($allSales);

        } catch (\Exception $e) {
            // Log the full error for server-side debugging
            Log::error('Failed to retrieve sales data: ' . $e->getMessage(), [
                'exception_file' => $e->getFile(),
                'exception_line' => $e->getLine(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            // Return a detailed error response to the client
            return response()->json([
                'error' => 'Failed to retrieve sales data.',
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ], 500);
        }
    }
    public function getAllSales()
    {
        $sales = Sale::all(); // or your logic
        return response()->json(['sales' => $sales]);
    }

    public function getLoanAmount(Request $request)
    {
        // Validate the request to ensure a customer_short_name is present.
        $request->validate(['customer_short_name' => 'required|string']);

        $customerShortName = $request->input('customer_short_name');

        // Sum of 'old' loan_type amounts
        $oldSum = CustomersLoan::where('customer_short_name', $customerShortName)
            ->where('loan_type', 'old')
            ->sum('amount');

        // Sum of 'today' loan_type amounts
        $todaySum = CustomersLoan::where('customer_short_name', $customerShortName)
            ->where('loan_type', 'today')
            ->sum('amount');

        // Calculate total loan amount based on your logic
        if ($todaySum == 0) {
            $totalLoanAmount = $oldSum;
        } else {
            $totalLoanAmount = $todaySum - $oldSum;
        }

        // Return the sum as a JSON response.
        return response()->json(['total_loan_amount' => $totalLoanAmount]);
    }


    public function updateGivenAmount(Request $request, Sale $sale)
    {
        $validated = $request->validate([
            'given_amount' => 'required|numeric|min:0',
            // Validate that credit_transaction is either Y or N
            'credit_transaction' => 'sometimes|string|in:Y,N',
        ]);

        // Update the sale with both the amount and the credit flag
        $sale->update([
            'given_amount' => $validated['given_amount'],
            // Fallback to 'N' if the frontend doesn't send it for some reason
            'credit_transaction' => $request->get('credit_transaction', 'N'),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Given amount and credit status updated successfully',
            'sale' => $sale->fresh() // .fresh() ensures you return the latest DB state
        ]);
    }
 public function processDay(Request $request)
{
    $recipientEmails = ['nethmavilhan@gmail.com', 'thrcorner@gmail.com'];

    // Use selected date from frontend
    $processLogDate = $request->input('date') ?? now()->toDateString();
    $startDate = $request->input('start_date', $processLogDate);
    $endDate = $request->input('end_date', $processLogDate);

    // Get last stored date from settings.value (ONLY for adjustments)
    $lastSetting = Setting::where('key', 'last_day_started_date')->first();
    $adjustmentDate = $lastSetting ? $lastSetting->value : $processLogDate;

    // Get currently logged in user's user_id to match with UniqueCode column
    $currentUserId = auth()->user()->user_id;

    // 1. Fetch Current Sales - ALL records where UniqueCode matches current user's user_id
    $allSales = Sale::where('UniqueCode', $currentUserId)->get();

    $totalRecordsToMove = $allSales->count();

    if ($totalRecordsToMove === 0) {
        return response()->json([
            'success' => false,
            'message' => "No sales records found for user_id: $currentUserId (UniqueCode match)."
        ], 404);
    }

    // Extract all unique supplier_bill_no from the sales records being moved
    $supplierBillNumbers = $allSales->pluck('supplier_bill_no')
        ->filter() // Remove null/empty values
        ->unique()
        ->values()
        ->toArray();

    // 2. Fetch Adjustments using PREVIOUS stored date
    $adjustments = Salesadjustment::whereDate('Date', $adjustmentDate)
        ->orderBy('created_at', 'desc')
        ->get();

    // ============ FIX: Reset supplier advance amounts with proper date handling ============
    try {
        // First, get suppliers with advance_created_date matching the process date
        // Use raw query to handle the date comparison properly
        $suppliersToReset = DB::table('suppliers')
            ->whereNotNull('advance_created_date')
            ->whereRaw("DATE(advance_created_date) = ?", [$processLogDate])
            ->get();

        if ($suppliersToReset->isNotEmpty()) {
            // Update each supplier individually to avoid datetime issues
            foreach ($suppliersToReset as $supplier) {
                DB::table('suppliers')
                    ->where('id', $supplier->id)
                    ->update([
                        'advance_amount' => 0,
                        'advance_created_date' => null,
                        'updated_at' => now()
                    ]);
            }

            Log::info("Reset advance amounts for " . $suppliersToReset->count() . " suppliers on date: $processLogDate");
        }
    } catch (\Exception $e) {
        Log::error("Error resetting supplier advances: " . $e->getMessage());
        // Continue with the process even if this fails
    }

    // 3. Fetch Supplier Loans to move - ONLY those matching supplier_bill_no from sales
    $supplierLoans = SupplierLoan::whereIn('bill_no', $supplierBillNumbers)->get();

    // 3. Summarize Sales
    $summarizedSales = Sale::selectRaw("
        item_code,
        item_name,
        SUM(packs) AS packs,
        SUM(weight) AS weight,
        SUM(total) AS total
    ")
        ->where('UniqueCode', $currentUserId) // Match user_id with UniqueCode column
        ->groupBy('item_code', 'item_name')
        ->orderBy('item_name', 'asc')
        ->get();

    // Add pack_due
    $summarizedSales = $summarizedSales->map(function ($sale) {
        $item = Item::where('no', $sale->item_code)->first();
        $sale->pack_cost = $item ? $item->pack_due : 0;
        return $sale;
    });

    // 4. Group Sales by Customer -> Bill
    $groupedSales = $allSales->groupBy('customer_code')->map(function ($customerSales) {
        return $customerSales->groupBy('bill_no');
    });

    // 5. Supplier Report - ALL records for current user's sales
    $supplierReport = Sale::select([
        'supplier_code',
        'customer_code',
        'item_code',
        'item_name',
        'SupplierWeight',
        'SupplierPricePerKg',
        'SupplierTotal',
        'SupplierPackCost',
        'SupplierPackLabour',
        'profit',
        'supplier_bill_printed',
        'supplier_bill_no',
        'Date',
        'created_at'
    ])
        ->where('UniqueCode', $currentUserId) // Match user_id with UniqueCode column
        ->orderBy('Date', 'desc')
        ->get()
        ->groupBy('supplier_code');

    // Totals for sales report
    $totals = $summarizedSales->reduce(function ($acc, $sale) {
        $acc['total_weight'] += (float) $sale->weight;
        $acc['total_net_total'] += ((float) $sale->total - ((float) $sale->packs * (float) $sale->pack_cost));
        return $acc;
    }, [
        'total_weight' => 0.0,
        'total_net_total' => 0.0
    ]);

    // ========== PAYMENT COLLECTION REPORT DATA ==========
    // Group by customer_code and bill_no for payment report
    $groupedBills = [];

    foreach ($allSales as $sale) {
        $key = ($sale->customer_code ?: 'Unknown') . '/' . ($sale->bill_no ?: 'N/A');

        if (!isset($groupedBills[$key])) {
            $groupedBills[$key] = [
                'customer_bill_no' => $key,
                'cash_collection' => 0,
                'cheques_collection' => 0,
                'bag_box_total' => 0,
                'bag_total' => 0,
                'box_total' => 0,
                'banks_transfer' => 0,
                'bad_debt' => 0
            ];
        }

        $paymentType = $sale->payment_adjustment_type;
        $givenAmount = floatval($sale->given_amount ?? 0);
        $adjustmentAmount = floatval($sale->adjustment_amount ?? 0);

        // Cash payments
        if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
            $groupedBills[$key]['cash_collection'] += $givenAmount;
        }
        // Cheque payments
        elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
            $groupedBills[$key]['cheques_collection'] += $givenAmount;
        }
        // Bank Transfer payments
        elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
            $groupedBills[$key]['banks_transfer'] += $givenAmount;
        }
        // Bag to Box adjustments
        elseif ($paymentType === 'bag_to_box') {
            $groupedBills[$key]['bag_box_total'] += $adjustmentAmount;
            $groupedBills[$key]['bag_total'] += floatval($sale->bag_count ?? 0);
            $groupedBills[$key]['box_total'] += floatval($sale->box_count ?? 0);
        }
        // Bill to Bill adjustments - treat as Bag Box Total
        elseif ($paymentType === 'bill_to_bill') {
            $groupedBills[$key]['bag_box_total'] += $adjustmentAmount;
        }
        // Bad Debt adjustments
        elseif ($paymentType === 'bad_debt') {
            $groupedBills[$key]['bad_debt'] += $adjustmentAmount;
        }
    }

    // Calculate payment totals
    $paymentTotals = [
        'cash_collection' => 0,
        'cheques_collection' => 0,
        'bag_box_total' => 0,
        'bag_total' => 0,
        'box_total' => 0,
        'banks_transfer' => 0,
        'bad_debt' => 0
    ];

    $paymentData = [];
    foreach ($groupedBills as $bill) {
        $paymentData[] = $bill;
        $paymentTotals['cash_collection'] += $bill['cash_collection'];
        $paymentTotals['cheques_collection'] += $bill['cheques_collection'];
        $paymentTotals['bag_box_total'] += $bill['bag_box_total'];
        $paymentTotals['bag_total'] += $bill['bag_total'];
        $paymentTotals['box_total'] += $bill['box_total'];
        $paymentTotals['banks_transfer'] += $bill['banks_transfer'];
        $paymentTotals['bad_debt'] += $bill['bad_debt'];
    }

    // Email Data
    $reportData = [
        'processLogDate' => $processLogDate,
        'adjustmentDate' => $adjustmentDate,
        'totalRecordsMoved' => $totalRecordsToMove,
        'sales' => $summarizedSales,
        'raw_sales' => $allSales,
        'grouped_sales' => $groupedSales,
        'adjustments' => $adjustments,
        'supplier_report' => $supplierReport,
        'totals' => $totals,
        // Payment collection data
        'payment_data' => $paymentData,
        'payment_totals' => $paymentTotals,
        // Supplier loans data
        'supplier_loans_moved' => $supplierLoans->count(),
        'current_user_id' => $currentUserId
    ];

    DB::beginTransaction();

    try {
        // ==================== MOVE SALES TO HISTORY ====================
        $historyData = [];
        $allowedColumns = (new Sale())->getFillable();
        $columnsPerRow = count($allowedColumns);

        // Calculate safe chunk size based on MySQL placeholder limit (65535)
        $maxPlaceholders = 60000;
        $chunkSize = max(1, floor($maxPlaceholders / $columnsPerRow));
        $chunkSize = min(500, $chunkSize);

        foreach ($allSales as $sale) {
            $data = $sale->only($allowedColumns);
            unset($data['id']);
            $data['bag_real_weight'] = $sale->bag_real_weight ?? 0;

            // Preserve original timestamps
            if ($sale->created_at) {
                $data['created_at'] = $sale->created_at;
            }
            if ($sale->updated_at) {
                $data['updated_at'] = $sale->updated_at;
            }

            foreach ($data as $key => $value) {
                if (is_array($value)) {
                    $data[$key] = json_encode($value);
                }
            }

            $historyData[] = $data;
        }

        if (!empty($historyData)) {
            foreach (array_chunk($historyData, $chunkSize) as $chunk) {
                SalesHistory::insert($chunk);
            }
            Sale::where('UniqueCode', $currentUserId)->delete();
        }

        // ==================== MOVE SUPPLIER LOANS TO HISTORY ====================
        if ($supplierLoans->count() > 0) {
            // Explicitly define the columns that exist in both tables
            $loanColumns = [
                'Creditor_no',
                'Date',
                'adjustment_amount',
                'bad_debt_amount',
                'bad_debt_name',
                'bag_amount',
                'bag_count',
                'bag_value',
                'bank_account_id',
                'bank_name',
                'bill_no',
                'box_count',
                'box_value',
                'cashier_name',
                'cheque_no',
                'code',
                'loan_amount',
                'notes',
                'payment_details',
                'payment_type',
                'realized_date',
                'target_bill_no',
                'target_bill_value',
                'target_customer_code',
                'target_supplier_bill_no',
                'target_supplier_bill_value',
                'target_supplier_code',
                'total_amount',
                'transfer_date',
                'transfer_notes',
                'transfer_reference_no',
                'type'
            ];

            // Add created_at and updated_at if they exist in the history table
            $historyTableColumns = Schema::getColumnListing('supplier_loans_history');
            if (in_array('created_at', $historyTableColumns)) {
                $loanColumns[] = 'created_at';
            }
            if (in_array('updated_at', $historyTableColumns)) {
                $loanColumns[] = 'updated_at';
            }

            $loanColumnsPerRow = count($loanColumns);
            $loanChunkSize = max(1, floor($maxPlaceholders / $loanColumnsPerRow));
            $loanChunkSize = min(500, $loanChunkSize);

            $loanHistoryData = [];

            foreach ($supplierLoans as $loan) {
                $loanData = [];

                // Only include the columns we explicitly defined
                foreach ($loanColumns as $column) {
                    // Skip id column if it exists in the loan columns list
                    if ($column === 'id') {
                        continue;
                    }

                    $value = $loan->$column ?? null;

                    // Handle JSON encoding for array values
                    if (is_array($value)) {
                        $value = json_encode($value);
                    }

                    $loanData[$column] = $value;
                }

                // Ensure payment_details is properly JSON encoded if it's an array
                if (isset($loanData['payment_details']) && is_array($loanData['payment_details'])) {
                    $loanData['payment_details'] = json_encode($loanData['payment_details']);
                }

                $loanHistoryData[] = $loanData;
            }

            // Insert supplier loan history in chunks
            if (!empty($loanHistoryData)) {
                foreach (array_chunk($loanHistoryData, $loanChunkSize) as $chunk) {
                    SupplierLoanHistory::insert($chunk);
                }

                // Delete ONLY the supplier loan records that were moved
                SupplierLoan::whereIn('bill_no', $supplierBillNumbers)->delete();
            }
        }

        // ==================== SAVE DATE TO SETTINGS ====================
        Setting::updateOrCreate(
            ['key' => 'last_day_started_date'],
            ['value' => $processLogDate]
        );

        DB::commit();

        // ==================== SEND EMAIL ====================
        try {
            foreach ($recipientEmails as $recipient) {
                Mail::to($recipient)->send(new DayEndWeightReportMail($reportData));
            }
            Log::info("Day end report sent successfully to: " . implode(', ', $recipientEmails));
        } catch (\Exception $e) {
            Log::error("Mail Error: " . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => "Process complete. Moved $totalRecordsToMove sales records and " . $supplierLoans->count() . " supplier loan records for user_id: $currentUserId. Reports emailed to " . count($recipientEmails) . " recipients.",
            'adjustment_date_used' => $adjustmentDate,
            'saved_date' => $processLogDate,
            'payment_totals' => $paymentTotals,
            'supplier_loans_moved' => $supplierLoans->count(),
            'sales_records_moved' => $totalRecordsToMove,
            'current_user_id' => $currentUserId
        ]);

    } catch (\Exception $e) {
        DB::rollBack();

        // Log the full error details
        Log::error('ProcessDay Error: ' . $e->getMessage());
        Log::error('Error Trace: ' . $e->getTraceAsString());

        return response()->json([
            'success' => false,
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
}



    public function viewPublicBill($token)
    {
        $bill = DB::table('bill_links')->where('token', $token)->first();

        if (!$bill) {
            return response()->json(['message' => 'Bill not found'], 404);
        }

        return response()->json($bill);
    }

    public function updateGivenAmountApplied(Request $request)
    {
        \Log::info('updateGivenAmountApplied called', $request->all());

        $request->validate([
            'bill_no' => 'required|string',
            'given_amount' => 'nullable|numeric|min:0',
            'given_amount_applied' => 'required|in:Y,N',
            'credit_transaction' => 'nullable|in:Y,N',
            'payment_amount' => 'required|numeric|min:0',
            'payment_method' => 'required|string',
            'cheq_date' => 'nullable|date',
            'cheq_no' => 'nullable|string|max:255',
            'bank_account_id' => 'nullable|integer|exists:banks,id',
            'bank_name' => 'nullable|string|max:255',
            'transfer_reference_no' => 'nullable|string|max:255',
            'transfer_date' => 'nullable|date',
            'transfer_notes' => 'nullable|string',
            'bag_count' => 'nullable|integer',
            'box_count' => 'nullable|integer',
            'bag_value' => 'nullable|numeric',
            'box_value' => 'nullable|numeric',
            'target_customer_code' => 'nullable|string',
            'target_bill_no' => 'nullable|string',
            'target_bill_value' => 'nullable|numeric',
            'target_supplier_code' => 'nullable|string',
            'target_supplier_bill_no' => 'nullable|string',
            'target_supplier_bill_value' => 'nullable|numeric',
            'bad_debt_name' => 'nullable|string',
            'bad_debt_amount' => 'nullable|numeric'
        ]);

        try {
            DB::beginTransaction();

            // ========== CHECK IF THIS IS AN ARCHIVED BILL ==========
            // First check in SalesHistory (archived bills)
            $archivedSale = DB::table('sales_histories')
                ->where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->first();

            // Determine which table to update
            $isArchived = ($archivedSale !== null);
            $tableName = $isArchived ? 'sales_histories' : 'sales';

            // Log which table we're updating
            \Log::info('Updating bill in table', [
                'bill_no' => $request->bill_no,
                'table' => $tableName,
                'is_archived' => $isArchived
            ]);

            // Get the current sale record from the appropriate table
            $sale = DB::table($tableName)
                ->where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->first();

            if (!$sale) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'No sales found with this bill_no',
                    'bill_no' => $request->bill_no
                ], 404);
            }

            // Get the customer code from the sale
            $customerCode = $sale->customer_code;
            $debtorNo = null;

            // Try to find debtor record for this bill
            $debtorRecord = Debtor::where('bill_no', $request->bill_no)
                ->where('customer_code', $customerCode)
                ->first();

            if ($debtorRecord) {
                $debtorNo = $debtorRecord->Debtor_no;
                \Log::info('Found debtor record for bill', [
                    'bill_no' => $request->bill_no,
                    'debtor_no' => $debtorNo
                ]);
            } else {
                // If no debtor record for this bill, try to get from customer table
                $customer = Customer::where('short_name', $customerCode)->first();
                if ($customer && $customer->Debtor_no) {
                    $debtorNo = $customer->Debtor_no;
                    \Log::info('Using customer debtor number', [
                        'customer_code' => $customerCode,
                        'debtor_no' => $debtorNo
                    ]);
                }
            }

            // Get existing payment history or initialize empty array
            $paymentHistory = [];
            if ($sale->payment_history) {
                if (is_string($sale->payment_history)) {
                    $paymentHistory = json_decode($sale->payment_history, true) ?: [];
                } elseif (is_array($sale->payment_history)) {
                    $paymentHistory = $sale->payment_history;
                }
            }

            // Calculate new running total
            $previousTotal = (float) ($sale->given_amount ?? 0);
            $paymentAmount = (float) $request->payment_amount;
            $newTotal = $previousTotal + $paymentAmount;
            $isFullyPaid = $request->given_amount_applied === 'Y';

            // Create payment record
            $paymentRecord = [
                'id' => uniqid(),
                'date' => now()->toDateTimeString(),
                'amount' => $paymentAmount,
                'method' => $request->payment_method,
                'running_balance' => $newTotal,
                'is_fully_paid' => $isFullyPaid,
                'reference' => null,
                'details' => []
            ];

            // Add specific payment details based on method
            if ($request->payment_method === 'Cheque') {
                $paymentRecord['reference'] = $request->cheq_no;
                $paymentRecord['details'] = [
                    'cheq_no' => $request->cheq_no,
                    'cheq_date' => $request->cheq_date,
                    'bank_account_id' => $request->bank_account_id,
                    'bank_name' => $request->bank_name
                ];
            } elseif ($request->payment_method === 'Bank Transfer') {
                $paymentRecord['reference'] = $request->transfer_reference_no;
                $paymentRecord['details'] = [
                    'transfer_reference_no' => $request->transfer_reference_no,
                    'transfer_date' => $request->transfer_date,
                    'transfer_notes' => $request->transfer_notes,
                    'bank_account_id' => $request->bank_account_id,
                    'bank_name' => $request->bank_name
                ];
            } elseif ($request->payment_method === 'bag_to_box') {
                $adjustmentAmount = ((int) $request->bag_count * (float) $request->bag_value) - ((int) $request->box_count * (float) $request->box_value);
                $paymentRecord['reference'] = "{$request->bag_count} bags to {$request->box_count} boxes";
                $paymentRecord['details'] = [
                    'bag_count' => (int) $request->bag_count,
                    'box_count' => (int) $request->box_count,
                    'bag_value' => (float) $request->bag_value,
                    'box_value' => (float) $request->box_value,
                    'adjustment_amount' => $adjustmentAmount
                ];
            } elseif ($request->payment_method === 'bill_to_bill') {
                $paymentRecord['reference'] = $request->target_bill_no;
                $paymentRecord['details'] = [
                    'target_customer_code' => $request->target_customer_code,
                    'target_bill_no' => $request->target_bill_no,
                    'target_bill_value' => (float) $request->target_bill_value,
                    'target_supplier_code' => $request->target_supplier_code,
                    'target_supplier_bill_no' => $request->target_supplier_bill_no,
                    'target_supplier_bill_value' => (float) $request->target_supplier_bill_value
                ];
            } elseif ($request->payment_method === 'bad_debt') {
                $paymentRecord['reference'] = $request->bad_debt_name;
                $paymentRecord['details'] = [
                    'bad_debt_name' => $request->bad_debt_name,
                    'bad_debt_amount' => (float) $request->bad_debt_amount
                ];
            } elseif ($request->payment_method === 'Credit') {
                $paymentRecord['reference'] = 'Credit Payment';
                $paymentRecord['details'] = [
                    'credit_amount' => $paymentAmount,
                    'is_credit' => true
                ];
            } else { // Cash
                $paymentRecord['reference'] = 'Cash';
                $paymentRecord['details'] = [];
            }

            // Add debtor_no to payment record details if available
            if ($debtorNo) {
                $paymentRecord['details']['debtor_no'] = $debtorNo;
            }

            // Add to payment history array
            $paymentHistory[] = $paymentRecord;

            // Build update data for the appropriate table
            $updateData = [
                'given_amount' => $newTotal,
                'given_amount_applied' => $request->given_amount_applied,
                'credit_transaction' => $request->credit_transaction ?? 'N',
                'payment_adjustment_type' => $request->payment_method,
                'adjustment_amount' => $paymentAmount,
                'payment_history' => json_encode($paymentHistory),
                'updated_at' => now()
            ];

            // Add debtor_no to update data if available
            if ($debtorNo) {
                $updateData['Debtor_no'] = $debtorNo;
                \Log::info('Storing debtor_no in ' . $tableName, [
                    'bill_no' => $request->bill_no,
                    'debtor_no' => $debtorNo
                ]);
            }

            // Add latest payment details to main columns for quick reference
            if ($request->payment_method === 'Bank Transfer') {
                if ($request->has('bank_account_id') && $request->bank_account_id) {
                    $updateData['bank_account_id'] = $request->bank_account_id;
                    $bank = Bank::find($request->bank_account_id);
                    if ($bank) {
                        $updateData['bank_name'] = $bank->bank_name;
                    }
                }
                $updateData['transfer_reference_no'] = $request->transfer_reference_no;
                $updateData['transfer_date'] = $request->transfer_date;
                $updateData['transfer_notes'] = $request->transfer_notes;
                $updateData['cheq_date'] = null;
                $updateData['cheq_no'] = null;
            } elseif ($request->payment_method === 'Cheque') {
                $updateData['cheq_date'] = $request->cheq_date;
                $updateData['cheq_no'] = $request->cheq_no;
                if ($request->has('bank_account_id') && $request->bank_account_id) {
                    $updateData['bank_account_id'] = $request->bank_account_id;
                    $bank = Bank::find($request->bank_account_id);
                    if ($bank) {
                        $updateData['bank_name'] = $bank->bank_name;
                    }
                }
                $updateData['transfer_reference_no'] = null;
                $updateData['transfer_date'] = null;
                $updateData['transfer_notes'] = null;
            } elseif ($request->payment_method === 'bag_to_box') {
                $updateData['bag_count'] = $request->bag_count;
                $updateData['box_count'] = $request->box_count;
                $updateData['bag_value'] = $request->bag_value;
                $updateData['box_value'] = $request->box_value;
            } elseif ($request->payment_method === 'bill_to_bill') {
                $updateData['target_customer_code'] = $request->target_customer_code;
                $updateData['target_bill_no'] = $request->target_bill_no;
                $updateData['target_bill_value'] = $request->target_bill_value;
                $updateData['target_supplier_code'] = $request->target_supplier_code;
                $updateData['target_supplier_bill_no'] = $request->target_supplier_bill_no;
                $updateData['target_supplier_bill_value'] = $request->target_supplier_bill_value;
            } elseif ($request->payment_method === 'bad_debt') {
                $updateData['bad_debt_name'] = $request->bad_debt_name;
                $updateData['bad_debt_amount'] = $request->bad_debt_amount;
            } else { // Cash or Credit
                $updateData['cheq_date'] = null;
                $updateData['cheq_no'] = null;
                $updateData['bank_account_id'] = null;
                $updateData['transfer_reference_no'] = null;
                $updateData['transfer_date'] = null;
                $updateData['transfer_notes'] = null;
            }

            // Update the record in the appropriate table
            $updated = DB::table($tableName)
                ->where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->update($updateData);

            if ($updated === 0) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to update sales record',
                    'bill_no' => $request->bill_no
                ], 404);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Successfully updated with {$request->payment_method} payment",
                'data' => [
                    'bill_no' => $request->bill_no,
                    'given_amount' => $newTotal,
                    'given_amount_applied' => $request->given_amount_applied,
                    'payment_method' => $request->payment_method,
                    'payment_history' => $paymentHistory,
                    'debtor_no' => $debtorNo,
                    'affected_rows' => $updated,
                    'is_archived' => $isArchived,
                    'table_updated' => $tableName
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating given amount applied:', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Internal server error: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }
    /**
     * Update single sale record
     */
    public function updateSaleGivenAmount(Request $request, $saleId)
    {
        $request->validate([
            'given_amount' => 'nullable|numeric|min:0',
            'given_amount_applied' => 'nullable|in:Y,N',
            'credit_transaction' => 'nullable|in:Y,N',
            'cheq_date' => 'nullable|date',
            'cheq_no' => 'nullable|string|max:255',
            'bank_name' => 'nullable|string|max:255',
            'transfer_reference_no' => 'nullable|string|max:255',
            'transfer_date' => 'nullable|date',
            'transfer_notes' => 'nullable|string'
        ]);

        try {
            $sale = Sale::findOrFail($saleId);

            $sale->given_amount = $request->given_amount ?? $sale->given_amount;
            $sale->given_amount_applied = $request->given_amount_applied ?? $sale->given_amount_applied;
            $sale->credit_transaction = $request->credit_transaction ?? $sale->credit_transaction;

            // Update cheque details if provided
            if ($request->has('cheq_date')) {
                $sale->cheq_date = $request->cheq_date;
            }
            if ($request->has('cheq_no')) {
                $sale->cheq_no = $request->cheq_no;
            }
            if ($request->has('bank_name')) {
                $sale->bank_name = $request->bank_name;
            }

            // Update bank transfer details if provided
            if ($request->has('transfer_reference_no')) {
                $sale->transfer_reference_no = $request->transfer_reference_no;
            }
            if ($request->has('transfer_date')) {
                $sale->transfer_date = $request->transfer_date;
            }
            if ($request->has('transfer_notes')) {
                $sale->transfer_notes = $request->transfer_notes;
            }

            // Determine payment type based on provided fields
            if ($request->has('transfer_reference_no') && !empty($request->transfer_reference_no)) {
                $sale->payment_adjustment_type = 'Bank Transfer';
            } elseif ($request->has('cheq_no') && !empty($request->cheq_no)) {
                $sale->payment_adjustment_type = 'Cheque';
            } else {
                $sale->payment_adjustment_type = 'Cash';
            }

            $sale->save();

            return response()->json([
                'success' => true,
                'message' => 'Sale updated successfully',
                'data' => $sale
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found or update failed'
            ], 404);
        }
    }
    public function getBanks()
    {
        try {
            $banks = Bank::all(['id', 'bank_name', 'branch', 'account_no']);
            return response()->json([
                'success' => true,
                'data' => $banks
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch banks'
            ], 500);
        }
    }

    /**
     * Get pending bills for bill-to-bill adjustment (Customer)
     */
    public function getPendingCustomerBills(Request $request)
    {
        try {
            $request->validate([
                'customer_code' => 'required|string'
            ]);

            $customerCode = $request->customer_code;

            // Fix: Use DB::raw in having clause and properly reference columns
            $pendingBills = DB::table('sales')
                ->select(
                    'bill_no',
                    'customer_code',
                    DB::raw('SUM(total + (packs * CustomerPackCost)) as total_amount'),
                    DB::raw('MAX(given_amount) as given_amount')
                )
                ->where('customer_code', $customerCode)
                ->where('bill_printed', 'Y')
                ->where('given_amount_applied', 'N')
                ->groupBy('bill_no', 'customer_code')
                ->havingRaw('SUM(total + (packs * CustomerPackCost)) > COALESCE(MAX(given_amount), 0)')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $pendingBills
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch pending customer bills: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending bills: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get pending farmer bills (Supplier) - Fixed version
     */
    public function getPendingFarmerBills(Request $request)
    {
        try {
            $request->validate([
                'supplier_code' => 'required|string'
            ]);

            $supplierCode = $request->supplier_code;

            $pendingBills = DB::table('sales')
                ->select(
                    'supplier_bill_no',
                    'supplier_code',
                    DB::raw('SUM(SupplierTotal) as total_amount')
                )
                ->where('supplier_code', $supplierCode)
                ->where('supplier_bill_printed', 'Y')
                ->where('supplier_paid_status', 'N')
                ->whereNotNull('supplier_bill_no')
                ->groupBy('supplier_bill_no', 'supplier_code')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $pendingBills
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch pending farmer bills: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending farmer bills: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Apply payment adjustment and update remaining amount
     */
    public function applyPaymentAdjustment(Request $request)
    {
        $request->validate([
            'bill_no' => 'required|string',
            'adjustment_type' => 'required|in:bag_to_box,bill_to_bill,bad_debt',
            'original_bill_total' => 'required|numeric'
        ]);

        try {
            DB::beginTransaction();

            // Get the original bill total
            $totalBillAmount = Sale::where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->select(DB::raw('SUM(total + (packs * CustomerPackCost)) as total'))
                ->value('total');

            $adjustmentAmount = 0;
            $updateData = [
                'payment_adjustment_type' => $request->adjustment_type,
                'updated_at' => now()
            ];

            if ($request->adjustment_type === 'bag_to_box') {
                $request->validate([
                    'bag_count' => 'required|integer|min:0',
                    'box_count' => 'required|integer|min:0',
                    'bag_value' => 'required|numeric|min:0',
                    'box_value' => 'required|numeric|min:0'
                ]);

                $totalBagValue = $request->bag_count * $request->bag_value;
                $totalBoxValue = $request->box_count * $request->box_value;
                $adjustmentAmount = $totalBagValue - $totalBoxValue;

                $updateData['bag_count'] = $request->bag_count;
                $updateData['box_count'] = $request->box_count;
                $updateData['bag_value'] = $request->bag_value;
                $updateData['box_value'] = $request->box_value;
                $updateData['adjustment_amount'] = $adjustmentAmount;
            }

            if ($request->adjustment_type === 'bill_to_bill') {
                $request->validate([
                    'customer_code' => 'required|string',
                    'customer_bill_no' => 'required|string',
                    'customer_bill_value' => 'required|numeric|min:0'
                ]);

                $adjustmentAmount = $request->customer_bill_value;

                $updateData['target_customer_code'] = $request->customer_code;
                $updateData['target_bill_no'] = $request->customer_bill_no;
                $updateData['target_bill_value'] = $request->customer_bill_value;
                $updateData['adjustment_amount'] = $adjustmentAmount;

                // Update the target customer bill
                Sale::where('bill_no', $request->customer_bill_no)
                    ->where('bill_printed', 'Y')
                    ->update([
                        'given_amount' => DB::raw('COALESCE(given_amount, 0) + ' . $request->customer_bill_value),
                        'given_amount_applied' => DB::raw('CASE WHEN COALESCE(given_amount, 0) + ' . $request->customer_bill_value . ' >= total + (packs * CustomerPackCost) THEN "Y" ELSE "N" END'),
                        'updated_at' => now()
                    ]);
            }

            if ($request->adjustment_type === 'bad_debt') {
                $request->validate([
                    'bad_debt_name' => 'required|string',
                    'bad_debt_amount' => 'required|numeric|min:0'
                ]);

                $adjustmentAmount = $request->bad_debt_amount;
                $updateData['bad_debt_name'] = $request->bad_debt_name;
                $updateData['bad_debt_amount'] = $request->bad_debt_amount;
                $updateData['adjustment_amount'] = $adjustmentAmount;
            }

            // Update all sales in the bill with the adjustment
            Sale::where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->update($updateData);

            // Get current given amount and update
            $currentGiven = Sale::where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->value('given_amount');

            $newGivenAmount = ($currentGiven ?? 0) + $adjustmentAmount;

            Sale::where('bill_no', $request->bill_no)
                ->where('bill_printed', 'Y')
                ->update([
                    'given_amount' => $newGivenAmount,
                    'given_amount_applied' => $newGivenAmount >= $totalBillAmount ? 'Y' : 'N',
                    'credit_transaction' => $newGivenAmount >= $totalBillAmount ? 'N' : 'Y'
                ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment adjustment applied successfully',
                'data' => [
                    'adjustment_amount' => $adjustmentAmount,
                    'new_given_amount' => $newGivenAmount,
                    'remaining' => max(0, $totalBillAmount - $newGivenAmount)
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Payment adjustment failed:', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to apply adjustment: ' . $e->getMessage()
            ], 500);
        }
    }
    /**
     * Get payment history for a specific bill
     */
    public function getPaymentHistory($billNo)
    {
        try {
            // First try to find the bill in sales table
            $sale = DB::table('sales')
                ->where('bill_no', $billNo)
                ->where('bill_printed', 'Y')
                ->first();

            $isFromHistory = false;

            // If not found in sales, try sales_histories table
            if (!$sale) {
                $sale = DB::table('sales_histories')
                    ->where('bill_no', $billNo)
                    ->where('bill_printed', 'Y')
                    ->first();

                if ($sale) {
                    $isFromHistory = true;
                }
            }

            if (!$sale) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bill not found'
                ], 404);
            }

            // Get payment history - handle both string and array cases
            $paymentHistory = [];
            if ($sale->payment_history) {
                if (is_string($sale->payment_history)) {
                    $paymentHistory = json_decode($sale->payment_history, true) ?: [];
                } elseif (is_array($sale->payment_history)) {
                    $paymentHistory = $sale->payment_history;
                }
            }

            // Calculate totals from the appropriate table
            $totalPaid = (float) ($sale->given_amount ?? 0);
            $totalBill = 0;

            // Get total bill amount from the appropriate table
            $tableName = $isFromHistory ? 'sales_histories' : 'sales';

            $totalBillRecords = DB::table($tableName)
                ->where('bill_no', $billNo)
                ->where('bill_printed', 'Y')
                ->select(DB::raw('SUM(total + (packs * CustomerPackCost)) as total'))
                ->first();

            if ($totalBillRecords) {
                $totalBill = (float) ($totalBillRecords->total ?? 0);
            }

            $remaining = max(0, $totalBill - $totalPaid);

            // Format payments for display
            $formattedPayments = array_map(function ($payment) {
                return [
                    'date' => $payment['date'],
                    'amount' => (float) $payment['amount'],
                    'method' => $payment['method'],
                    'reference' => $payment['reference'] ?? null,
                    'running_balance' => $payment['running_balance'] ?? null,
                    'is_fully_paid' => $payment['is_fully_paid'] ?? false,
                    'details' => $payment['details'] ?? []
                ];
            }, $paymentHistory);

            return response()->json([
                'success' => true,
                'payments' => $formattedPayments,
                'total_paid' => $totalPaid,
                'total_bill' => $totalBill,
                'remaining' => $remaining,
                'source_table' => $tableName // Optional: indicate which table the data came from
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to fetch payment history: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payment history: ' . $e->getMessage()
            ], 500);
        }
    }
    public function getPaymentCollectionReport(Request $request)
    {
        try {
            // Get date range filter if provided
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');

            // Determine which table(s) to query
            $hasDateRange = ($startDate || $endDate);

            $allSales = collect(); // Use collection to merge results

            if ($hasDateRange) {
                // If date range is selected, fetch from SalesHistory (archived data)
                $query = SalesHistory::where('bill_printed', 'Y')
                    ->whereNotNull('bill_no')
                    ->where('bill_no', '!=', '');

                // Apply date filter
                if ($startDate) {
                    $query->whereDate('Date', '>=', $startDate);
                }
                if ($endDate) {
                    $query->whereDate('Date', '<=', $endDate);
                }

                $allSales = $query->get();
            } else {
                // If no date range, fetch from Sales (current data)
                $query = Sale::where('bill_printed', 'Y')
                    ->whereNotNull('bill_no')
                    ->where('bill_no', '!=', '');

                $allSales = $query->get();
            }

            // If no data found, return empty report
            if ($allSales->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'totals' => [
                        'cash_collection' => 0,
                        'cheques_collection' => 0,
                        'bag_box_total' => 0,
                        'bag_total' => 0,
                        'box_total' => 0,
                        'banks_transfer' => 0,
                        'bad_debt' => 0
                    ],
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate
                    ],
                    'source_table' => $hasDateRange ? 'sales_history' : 'sales'
                ]);
            }

            // Group by customer_code and bill_no
            $groupedBills = [];

            foreach ($allSales as $sale) {
                $key = ($sale->customer_code ?? 'Unknown') . '/' . ($sale->bill_no ?? 'N/A');

                if (!isset($groupedBills[$key])) {
                    $groupedBills[$key] = [
                        'customer_code' => $sale->customer_code,
                        'bill_no' => $sale->bill_no,
                        'cash_collection' => 0,
                        'cheques_collection' => 0,
                        'bag_box_total' => 0,
                        'bag_total' => 0,
                        'box_total' => 0,
                        'banks_transfer' => 0,
                        'bad_debt' => 0,
                        'sales_records' => []
                    ];
                }

                // Determine payment type and add amounts
                $paymentType = $sale->payment_adjustment_type;
                $givenAmount = floatval($sale->given_amount ?? 0);
                $adjustmentAmount = floatval($sale->adjustment_amount ?? 0);

                // Cash payments
                if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
                    $groupedBills[$key]['cash_collection'] += $givenAmount;
                }
                // Cheque payments
                elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
                    $groupedBills[$key]['cheques_collection'] += $givenAmount;
                }
                // Bank Transfer payments
                elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
                    $groupedBills[$key]['banks_transfer'] += $givenAmount;
                }
                // Bag to Box adjustments
                elseif ($paymentType === 'bag_to_box') {
                    $groupedBills[$key]['bag_box_total'] += $adjustmentAmount;
                    $groupedBills[$key]['bag_total'] += floatval($sale->bag_count ?? 0);
                    $groupedBills[$key]['box_total'] += floatval($sale->box_count ?? 0);
                }
                // Bill to Bill adjustments - treat as Bag Box Total
                elseif ($paymentType === 'bill_to_bill') {
                    $groupedBills[$key]['bag_box_total'] += $adjustmentAmount;
                }
                // Bad Debt adjustments
                elseif ($paymentType === 'bad_debt') {
                    $groupedBills[$key]['bad_debt'] += $adjustmentAmount;
                }

                $groupedBills[$key]['sales_records'][] = $sale;
            }

            // Calculate totals
            $totals = [
                'cash_collection' => 0,
                'cheques_collection' => 0,
                'bag_box_total' => 0,
                'bag_total' => 0,
                'box_total' => 0,
                'banks_transfer' => 0,
                'bad_debt' => 0
            ];

            $reportData = [];
            foreach ($groupedBills as $key => $bill) {
                $reportData[] = [
                    'customer_bill_no' => $key,
                    'cash_collection' => $bill['cash_collection'],
                    'cheques_collection' => $bill['cheques_collection'],
                    'bag_box_total' => $bill['bag_box_total'],
                    'bag_total' => $bill['bag_total'],
                    'box_total' => $bill['box_total'],
                    'banks_transfer' => $bill['banks_transfer'],
                    'bad_debt' => $bill['bad_debt']
                ];

                $totals['cash_collection'] += $bill['cash_collection'];
                $totals['cheques_collection'] += $bill['cheques_collection'];
                $totals['bag_box_total'] += $bill['bag_box_total'];
                $totals['bag_total'] += $bill['bag_total'];
                $totals['box_total'] += $bill['box_total'];
                $totals['banks_transfer'] += $bill['banks_transfer'];
                $totals['bad_debt'] += $bill['bad_debt'];
            }

            return response()->json([
                'success' => true,
                'data' => $reportData,
                'totals' => $totals,
                'filters' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ],
                'source_table' => $hasDateRange ? 'sales_history' : 'sales',
                'total_records' => $allSales->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get detailed payment breakdown by customer
     */
    public function getPaymentBreakdown(Request $request)
    {
        try {
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');

            $hasDateRange = ($startDate || $endDate);

            if ($hasDateRange) {
                // If date range is selected, fetch from SalesHistory
                $query = SalesHistory::where('bill_printed', 'Y')
                    ->whereNotNull('bill_no')
                    ->select(
                        'customer_code',
                        'bill_no',
                        'payment_adjustment_type',
                        'given_amount',
                        'adjustment_amount',
                        'bag_count',
                        'box_count',
                        'bag_value',
                        'box_value',
                        'cheq_no',
                        'cheq_date',
                        'bank_name',
                        'transfer_reference_no',
                        'bad_debt_name',
                        'bad_debt_amount',
                        'Date'
                    );
            } else {
                // If no date range, fetch from Sales
                $query = Sale::where('bill_printed', 'Y')
                    ->whereNotNull('bill_no')
                    ->select(
                        'customer_code',
                        'bill_no',
                        'payment_adjustment_type',
                        'given_amount',
                        'adjustment_amount',
                        'bag_count',
                        'box_count',
                        'bag_value',
                        'box_value',
                        'cheq_no',
                        'cheq_date',
                        'bank_name',
                        'transfer_reference_no',
                        'bad_debt_name',
                        'bad_debt_amount',
                        'Date'
                    );
            }

            if ($startDate) {
                $query->whereDate('Date', '>=', $startDate);
            }
            if ($endDate) {
                $query->whereDate('Date', '<=', $endDate);
            }

            $sales = $query->get();

            return response()->json([
                'success' => true,
                'data' => $sales,
                'source_table' => $hasDateRange ? 'sales_history' : 'sales',
                'total_records' => $sales->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get payment breakdown: ' . $e->getMessage()
            ], 500);
        }
    }
    /**
     * Get comprehensive payment report with summaries
     */
    public function getPaymentReport(Request $request)
    {
        try {
            $period = $request->input('period', 'today'); // today, week, month, custom
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');

            // Determine date range based on period
            $today = Carbon::today();
            switch ($period) {
                case 'today':
                    $startDate = $today->format('Y-m-d');
                    $endDate = $today->format('Y-m-d');
                    break;
                case 'week':
                    $startDate = $today->copy()->startOfWeek()->format('Y-m-d');
                    $endDate = $today->copy()->endOfWeek()->format('Y-m-d');
                    break;
                case 'month':
                    $startDate = $today->copy()->startOfMonth()->format('Y-m-d');
                    $endDate = $today->copy()->endOfMonth()->format('Y-m-d');
                    break;
                case 'custom':
                    // Use provided dates
                    break;
            }

            // Query current sales table
            $query = Sale::where('bill_printed', 'Y')
                ->whereNotNull('bill_no');

            if ($startDate) {
                $query->whereDate('Date', '>=', $startDate);
            }
            if ($endDate) {
                $query->whereDate('Date', '<=', $endDate);
            }

            $sales = $query->get();

            // Initialize report data
            $report = [
                'summary' => [
                    'cash_collection' => 0,
                    'cheque_collection' => 0,
                    'bank_transfer_collection' => 0,
                    'bag_to_box_total' => 0,
                    'bill_to_bill_total' => 0,
                    'bad_debt_total' => 0,
                    'total_given_amount' => 0,
                    'total_bill_amount' => 0,
                    'total_remaining' => 0,
                    'total_customers' => 0,
                    'total_bills' => 0,
                ],
                'breakdown_by_customer' => [],
                'breakdown_by_date' => [],
                'breakdown_by_payment_type' => [],
                'graph_data' => [
                    'labels' => [],
                    'cash' => [],
                    'cheque' => [],
                    'bank_transfer' => [],
                    'adjustments' => [],
                ]
            ];

            $customerSummary = [];
            $dateSummary = [];
            $paymentTypeSummary = [
                'Cash' => 0,
                'Cheque' => 0,
                'Bank Transfer' => 0,
                'bag_to_box' => 0,
                'bill_to_bill' => 0,
                'bad_debt' => 0,
            ];

            foreach ($sales as $sale) {
                $paymentType = $sale->payment_adjustment_type;
                $givenAmount = floatval($sale->given_amount ?? 0);
                $adjustmentAmount = floatval($sale->adjustment_amount ?? 0);
                $billTotal = $sale->total_payable;
                $dateKey = $sale->Date ?? $sale->created_at->format('Y-m-d');
                $customerCode = $sale->customer_code ?? 'Unknown';

                // Update totals
                $report['summary']['total_given_amount'] += $givenAmount;
                $report['summary']['total_bill_amount'] += $billTotal;

                // Categorize by payment type
                if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
                    $report['summary']['cash_collection'] += $givenAmount;
                    $paymentTypeSummary['Cash'] += $givenAmount;
                } elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
                    $report['summary']['cheque_collection'] += $givenAmount;
                    $paymentTypeSummary['Cheque'] += $givenAmount;
                } elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
                    $report['summary']['bank_transfer_collection'] += $givenAmount;
                    $paymentTypeSummary['Bank Transfer'] += $givenAmount;
                } elseif ($paymentType === 'bag_to_box') {
                    $report['summary']['bag_to_box_total'] += $adjustmentAmount;
                    $paymentTypeSummary['bag_to_box'] += $adjustmentAmount;
                } elseif ($paymentType === 'bill_to_bill') {
                    $report['summary']['bill_to_bill_total'] += $adjustmentAmount;
                    $paymentTypeSummary['bill_to_bill'] += $adjustmentAmount;
                } elseif ($paymentType === 'bad_debt') {
                    $report['summary']['bad_debt_total'] += $adjustmentAmount;
                    $paymentTypeSummary['bad_debt'] += $adjustmentAmount;
                }

                // Customer breakdown
                if (!isset($customerSummary[$customerCode])) {
                    $customerSummary[$customerCode] = [
                        'customer_code' => $customerCode,
                        'total_bill' => 0,
                        'total_given' => 0,
                        'cash_paid' => 0,
                        'cheque_paid' => 0,
                        'bank_transfer_paid' => 0,
                        'adjustments' => 0,
                        'remaining' => 0,
                        'bill_count' => 0,
                    ];
                    $report['summary']['total_customers']++;
                }

                $customerSummary[$customerCode]['total_bill'] += $billTotal;
                $customerSummary[$customerCode]['total_given'] += $givenAmount;
                $customerSummary[$customerCode]['bill_count']++;

                if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
                    $customerSummary[$customerCode]['cash_paid'] += $givenAmount;
                } elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
                    $customerSummary[$customerCode]['cheque_paid'] += $givenAmount;
                } elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
                    $customerSummary[$customerCode]['bank_transfer_paid'] += $givenAmount;
                } elseif (in_array($paymentType, ['bag_to_box', 'bill_to_bill', 'bad_debt'])) {
                    $customerSummary[$customerCode]['adjustments'] += $adjustmentAmount;
                }

                $customerSummary[$customerCode]['remaining'] = $customerSummary[$customerCode]['total_bill'] - $customerSummary[$customerCode]['total_given'];

                // Date breakdown
                if (!isset($dateSummary[$dateKey])) {
                    $dateSummary[$dateKey] = [
                        'date' => $dateKey,
                        'cash' => 0,
                        'cheque' => 0,
                        'bank_transfer' => 0,
                        'adjustments' => 0,
                        'total' => 0,
                    ];
                }

                if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
                    $dateSummary[$dateKey]['cash'] += $givenAmount;
                } elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
                    $dateSummary[$dateKey]['cheque'] += $givenAmount;
                } elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
                    $dateSummary[$dateKey]['bank_transfer'] += $givenAmount;
                } elseif (in_array($paymentType, ['bag_to_box', 'bill_to_bill', 'bad_debt'])) {
                    $dateSummary[$dateKey]['adjustments'] += $adjustmentAmount;
                }
                $dateSummary[$dateKey]['total'] += $givenAmount + $adjustmentAmount;
            }

            // Calculate total remaining
            $report['summary']['total_remaining'] = $report['summary']['total_bill_amount'] - $report['summary']['total_given_amount'];
            $report['summary']['total_bills'] = $sales->unique('bill_no')->count();

            // Prepare breakdown arrays
            $report['breakdown_by_customer'] = array_values($customerSummary);
            $report['breakdown_by_date'] = array_values($dateSummary);
            $report['breakdown_by_payment_type'] = $paymentTypeSummary;

            // Prepare graph data (last 7 days)
            $graphLabels = [];
            $graphCash = [];
            $graphCheque = [];
            $graphBankTransfer = [];
            $graphAdjustments = [];

            for ($i = 6; $i >= 0; $i--) {
                $date = $today->copy()->subDays($i)->format('Y-m-d');
                $graphLabels[] = $today->copy()->subDays($i)->format('M d');

                $dayData = $dateSummary[$date] ?? ['cash' => 0, 'cheque' => 0, 'bank_transfer' => 0, 'adjustments' => 0];
                $graphCash[] = $dayData['cash'];
                $graphCheque[] = $dayData['cheque'];
                $graphBankTransfer[] = $dayData['bank_transfer'];
                $graphAdjustments[] = $dayData['adjustments'];
            }

            $report['graph_data'] = [
                'labels' => $graphLabels,
                'cash' => $graphCash,
                'cheque' => $graphCheque,
                'bank_transfer' => $graphBankTransfer,
                'adjustments' => $graphAdjustments,
            ];

            return response()->json([
                'success' => true,
                'report' => $report,
                'period' => $period,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to generate payment report: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get dashboard statistics
     */
    public function getDashboardStats(Request $request)
    {
        try {
            $today = Carbon::today();

            // Today's stats
            $todaySales = Sale::where('bill_printed', 'Y')
                ->whereDate('Date', $today)
                ->get();

            // This week's stats
            $weekStart = $today->copy()->startOfWeek();
            $weekEnd = $today->copy()->endOfWeek();
            $weekSales = Sale::where('bill_printed', 'Y')
                ->whereBetween('Date', [$weekStart, $weekEnd])
                ->get();

            // This month's stats
            $monthStart = $today->copy()->startOfMonth();
            $monthEnd = $today->copy()->endOfMonth();
            $monthSales = Sale::where('bill_printed', 'Y')
                ->whereBetween('Date', [$monthStart, $monthEnd])
                ->get();

            // Helper function to calculate stats
            $calculateStats = function ($sales) {
                $cash = 0;
                $cheque = 0;
                $bankTransfer = 0;
                $bagToBox = 0;
                $billToBill = 0;
                $badDebt = 0;
                $totalGiven = 0;

                foreach ($sales as $sale) {
                    $paymentType = $sale->payment_adjustment_type;
                    $givenAmount = floatval($sale->given_amount ?? 0);
                    $adjustmentAmount = floatval($sale->adjustment_amount ?? 0);
                    $totalGiven += $givenAmount;

                    if ($paymentType === 'cash' || $paymentType === 'Cash' || ($paymentType === null && $givenAmount > 0)) {
                        $cash += $givenAmount;
                    } elseif ($paymentType === 'cheque' || $paymentType === 'Cheque') {
                        $cheque += $givenAmount;
                    } elseif ($paymentType === 'Bank Transfer' || $paymentType === 'bank_transfer') {
                        $bankTransfer += $givenAmount;
                    } elseif ($paymentType === 'bag_to_box') {
                        $bagToBox += $adjustmentAmount;
                    } elseif ($paymentType === 'bill_to_bill') {
                        $billToBill += $adjustmentAmount;
                    } elseif ($paymentType === 'bad_debt') {
                        $badDebt += $adjustmentAmount;
                    }
                }

                return [
                    'cash' => $cash,
                    'cheque' => $cheque,
                    'bank_transfer' => $bankTransfer,
                    'bag_to_box' => $bagToBox,
                    'bill_to_bill' => $billToBill,
                    'bad_debt' => $badDebt,
                    'total_given' => $totalGiven,
                    'transactions' => $sales->count(),
                    'bills' => $sales->unique('bill_no')->count(),
                ];
            };

            return response()->json([
                'success' => true,
                'today' => $calculateStats($todaySales),
                'week' => $calculateStats($weekSales),
                'month' => $calculateStats($monthSales),
                'pending_bills' => Sale::where('bill_printed', 'Y')
                    ->where('given_amount_applied', 'N')
                    ->distinct('bill_no')
                    ->count('bill_no'),
                'total_customers' => Customer::count(),
                'debtors_count' => Customer::where('Debtor', 'Y')->count(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get dashboard stats: ' . $e->getMessage()
            ], 500);
        }
    }
    /**
     * Delete all payments for a specific bill (reverse the payment operation)
     */
    /**
     * Delete all payments for a specific bill (reverse the payment operation)
     */
    public function deleteBillPayments($billNo)
    {
        try {
            DB::beginTransaction();

            // Find all sales records for this bill
            $sales = Sale::where('bill_no', $billNo)
                ->where('bill_printed', 'Y')
                ->get();

            if ($sales->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No sales found for this bill number'
                ], 404);
            }

            // Get the customer_code from the first sale (all sales for same bill will have same customer_code)
            $customerCode = $sales->first()->customer_code;

            // Delete debtor records for this bill_no and customer_code
            $deletedDebtors = Debtor::where('bill_no', $billNo)
                ->where('customer_code', $customerCode)
                ->delete();

            // Reset all payment-related fields to their original state (before any payments)
            foreach ($sales as $sale) {
                $sale->update([
                    'given_amount' => 0,
                    'given_amount_applied' => 'N',
                    'credit_transaction' => 'Y',
                    'payment_adjustment_type' => null,
                    'adjustment_amount' => 0,
                    'payment_history' => null,
                    'cheq_date' => null,
                    'cheq_no' => null,
                    'bank_account_id' => null,
                    'bank_name' => null,
                    'transfer_reference_no' => null,
                    'transfer_date' => null,
                    'transfer_notes' => null,
                    'bag_count' => null,
                    'box_count' => null,
                    'bag_value' => null,
                    'box_value' => null,
                    'target_customer_code' => null,
                    'target_bill_no' => null,
                    'target_bill_value' => null,
                    'target_supplier_code' => null,
                    'target_supplier_bill_no' => null,
                    'target_supplier_bill_value' => null,
                    'bad_debt_name' => null,
                    'bad_debt_amount' => null,
                ]);
            }

            DB::commit();

            $debtorMessage = $deletedDebtors > 0
                ? " and {$deletedDebtors} debtor record(s) deleted"
                : "";

            return response()->json([
                'success' => true,
                'message' => "All payments for Bill #{$billNo} have been reversed successfully{$debtorMessage}",
                'affected_records' => $sales->count(),
                'deleted_debtors' => $deletedDebtors
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete bill payments: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to reverse payments: ' . $e->getMessage()
            ], 500);
        }
    }
    /**
     * Get archived sales from SalesHistory table with date range
     */
public function getArchivedSales(Request $request)
{
    try {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date'
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;
        $uniqueCode = $request->get('unique_code'); // Add this line

        $currentUser = auth()->user();

        $query = SalesHistory::where('bill_printed', 'Y');

        // Apply date filter
        $query->whereDate('Date', '>=', $startDate)
            ->whereDate('Date', '<=', $endDate);

        // Apply user filter if not admin
        if ($currentUser && $currentUser->role === 'User') {
            $query->where('UniqueCode', $currentUser->user_id);
        }

        // Apply unique code filter from dropdown (ADD THIS BLOCK)
        if ($uniqueCode && $uniqueCode !== 'all') {
            $query->where('UniqueCode', $uniqueCode);
        }

        $sales = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'sales' => $sales,
            'count' => $sales->count(),
            'date_range' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'applied_filter' => $uniqueCode // Optional: to debug which filter was applied
        ]);

    } catch (\Exception $e) {
        Log::error('Failed to fetch archived sales: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch archived sales: ' . $e->getMessage()
        ], 500);
    }
}
    public function updateCustomerAndDebtor(Request $request)
    {
        $request->validate([
            'bill_no' => 'required|string',
            'old_customer_code' => 'required|string',
            'new_customer_code' => 'required|string',
            'debtor_no' => 'nullable|string'
        ]);

        try {
            // Update all sales records with the same bill_no
            $updatedCount = Sale::where('bill_no', $request->bill_no)
                ->where('customer_code', $request->old_customer_code)
                ->update([
                    'customer_code' => $request->new_customer_code,
                    'Debtor_no' => $request->debtor_no
                ]);

            // Also update the debtor record if it exists
            if ($request->debtor_no) {
                // Update debtor table to link with new customer code
                \App\Models\Debtor::where('bill_no', $request->bill_no)
                    ->update([
                        'customer_code' => $request->new_customer_code,
                        'Debtor_no' => $request->debtor_no
                    ]);
            }

            return response()->json([
                'success' => true,
                'message' => "Customer code and debtor number updated successfully",
                'updated_count' => $updatedCount,
                'bill_no' => $request->bill_no,
                'old_customer_code' => $request->old_customer_code,
                'new_customer_code' => $request->new_customer_code,
                'debtor_no' => $request->debtor_no
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update: ' . $e->getMessage()
            ], 500);
        }
    }

public function getIncomeSources(Request $request)
{
    try {
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $uniqueCode = $request->input('unique_code');
        $bankName = $request->input('bank_name');

        $currentUser = auth()->user();

        // Initialize totals
        $totals = [
            'cash' => 0,
            'cheque' => 0,
            'bank_transfer' => 0,
            'bag_to_box' => 0,
            'bill_to_bill' => 0,
            'bad_debt' => 0,
            'total_income' => 0,
            'total_bills' => 0,
            'total_customers' => 0
        ];

        $billsData = [];

        // Track processed payment IDs to avoid duplicates
        $processedPaymentIds = [];

        // Helper function to process sales and extract payments from payment_history
        $processSales = function ($sales, $source) use (&$totals, &$billsData, &$processedPaymentIds) {
            $salesByBill = [];

            foreach ($sales as $sale) {
                $billNo = $sale->bill_no;
                $customerCode = $sale->customer_code ?? 'Unknown';
                $key = $customerCode . '/' . $billNo;

                if (!isset($salesByBill[$key])) {
                    $salesByBill[$key] = [
                        'customer_code' => $customerCode,
                        'bill_no' => $billNo,
                        'total_bill' => 0,
                        'paid_amount' => 0,
                        'cash' => 0,
                        'cheque' => 0,
                        'bank_transfer' => 0,
                        'bag_to_box' => 0,
                        'bill_to_bill' => 0,
                        'bad_debt' => 0,
                        'source' => $source,
                        'payment_ids' => [] // Track payment IDs for this bill
                    ];
                }

                // Calculate bill total (total + pack costs)
                $billTotal = (float) ($sale->total ?? 0) + ((float) ($sale->packs ?? 0) * (float) ($sale->CustomerPackCost ?? 0));
                $salesByBill[$key]['total_bill'] += $billTotal;

                // Get payments from payment_history JSON
                $paymentHistory = [];
                if ($sale->payment_history) {
                    if (is_string($sale->payment_history)) {
                        $paymentHistory = json_decode($sale->payment_history, true) ?: [];
                    } elseif (is_array($sale->payment_history)) {
                        $paymentHistory = $sale->payment_history;
                    }
                }

                // Process payments from payment_history array
                if (is_array($paymentHistory) && count($paymentHistory) > 0) {
                    foreach ($paymentHistory as $payment) {
                        $paymentId = $payment['id'] ?? null;
                        $amount = (float) ($payment['amount'] ?? 0);
                        $method = $payment['method'] ?? '';

                        // CRITICAL FIX: Skip if this payment ID has already been processed
                        if ($paymentId && in_array($paymentId, $processedPaymentIds)) {
                            \Log::info('Skipping duplicate payment', [
                                'payment_id' => $paymentId,
                                'bill_no' => $billNo,
                                'amount' => $amount
                            ]);
                            continue;
                        }

                        // Mark this payment as processed
                        if ($paymentId) {
                            $processedPaymentIds[] = $paymentId;
                            $salesByBill[$key]['payment_ids'][] = $paymentId;
                        }

                        // DEBUG: Log to see what methods are actually stored
                        \Log::info('Payment method found', [
                            'payment_id' => $paymentId,
                            'bill_no' => $billNo,
                            'customer' => $customerCode,
                            'method' => $method,
                            'amount' => $amount,
                            'has_details' => isset($payment['details'])
                        ]);

                        if ($amount <= 0) continue;

                        switch ($method) {
                            case 'Cash':
                                $salesByBill[$key]['cash'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['cash'] += $amount;
                                break;
                            case 'Cheque':
                                $salesByBill[$key]['cheque'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['cheque'] += $amount;
                                \Log::info('Added to Cheque total', ['amount' => $amount, 'new_total' => $totals['cheque']]);
                                break;
                            case 'Bank Transfer':
                                $salesByBill[$key]['bank_transfer'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['bank_transfer'] += $amount;
                                \Log::info('Added to Bank Transfer total', ['amount' => $amount, 'new_total' => $totals['bank_transfer']]);
                                break;
                            case 'bag_to_box':
                                $salesByBill[$key]['bag_to_box'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['bag_to_box'] += $amount;
                                break;
                            case 'bill_to_bill':
                                $salesByBill[$key]['bill_to_bill'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['bill_to_bill'] += $amount;
                                break;
                            case 'bad_debt':
                                $salesByBill[$key]['bad_debt'] += $amount;
                                $salesByBill[$key]['paid_amount'] += $amount;
                                $totals['bad_debt'] += $amount;
                                break;
                            case 'Credit':
                                // SKIP CREDIT - NOT INCLUDED IN INCOME
                                break;
                            default:
                                \Log::warning('Unknown payment method', ['method' => $method, 'amount' => $amount]);
                                break;
                        }
                    }
                } else {
                    // Fallback: Use payment_adjustment_type and given_amount if payment_history is empty
                    // Generate a unique ID for fallback payments to prevent duplicates
                    $fallbackId = 'fallback_' . $sale->id . '_' . $sale->bill_no;

                    if (!in_array($fallbackId, $processedPaymentIds)) {
                        $paymentType = $sale->payment_adjustment_type ?? '';
                        $givenAmount = (float) ($sale->given_amount ?? 0);
                        $adjustmentAmount = (float) ($sale->adjustment_amount ?? 0);
                        $badDebtAmount = (float) ($sale->bad_debt_amount ?? 0);

                        if ($paymentType === 'Cash' && $givenAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['cash'] += $givenAmount;
                            $salesByBill[$key]['paid_amount'] += $givenAmount;
                            $totals['cash'] += $givenAmount;
                        } elseif ($paymentType === 'Cheque' && $givenAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['cheque'] += $givenAmount;
                            $salesByBill[$key]['paid_amount'] += $givenAmount;
                            $totals['cheque'] += $givenAmount;
                        } elseif ($paymentType === 'Bank Transfer' && $givenAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['bank_transfer'] += $givenAmount;
                            $salesByBill[$key]['paid_amount'] += $givenAmount;
                            $totals['bank_transfer'] += $givenAmount;
                        } elseif ($paymentType === 'bag_to_box' && $adjustmentAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['bag_to_box'] += $adjustmentAmount;
                            $salesByBill[$key]['paid_amount'] += $adjustmentAmount;
                            $totals['bag_to_box'] += $adjustmentAmount;
                        } elseif ($paymentType === 'bill_to_bill' && $adjustmentAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['bill_to_bill'] += $adjustmentAmount;
                            $salesByBill[$key]['paid_amount'] += $adjustmentAmount;
                            $totals['bill_to_bill'] += $adjustmentAmount;
                        } elseif ($paymentType === 'bad_debt' && $badDebtAmount > 0) {
                            $processedPaymentIds[] = $fallbackId;
                            $salesByBill[$key]['bad_debt'] += $badDebtAmount;
                            $salesByBill[$key]['paid_amount'] += $badDebtAmount;
                            $totals['bad_debt'] += $badDebtAmount;
                        }
                    }
                }
            }

            // Remove payment_ids before sending to response (optional)
            foreach ($salesByBill as &$bill) {
                unset($bill['payment_ids']);
            }

            foreach ($salesByBill as $bill) {
                $billsData[] = $bill;
            }

            $totals['total_bills'] += count($salesByBill);
            $totals['total_customers'] += count(array_unique(array_column($salesByBill, 'customer_code')));
        };

        // Query current sales table
        $currentSalesQuery = Sale::query();

        // Apply UniqueCode filter
        if ($uniqueCode && $uniqueCode !== 'all') {
            $currentSalesQuery->where('UniqueCode', $uniqueCode);
        }

        // Apply Bank Name filter
        if ($bankName && $bankName !== 'all') {
            $currentSalesQuery->where(function($query) use ($bankName) {
                $query->where('bank_name', $bankName)
                      ->orWhereJsonContains('payment_history', ['details' => ['bank_name' => $bankName]]);
            });
        }

        // Apply date filter if provided
        if ($startDate) {
            $currentSalesQuery->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $currentSalesQuery->whereDate('created_at', '<=', $endDate);
        }

        $currentSales = $currentSalesQuery->get();
        \Log::info('Current sales count: ' . $currentSales->count());
        $processSales($currentSales, 'current');

        // Query archived sales table
        $archivedSalesQuery = SalesHistory::query();

        // Apply UniqueCode filter
        if ($uniqueCode && $uniqueCode !== 'all') {
            $archivedSalesQuery->where('UniqueCode', $uniqueCode);
        }

        // Apply Bank Name filter
        if ($bankName && $bankName !== 'all') {
            $archivedSalesQuery->where(function($query) use ($bankName) {
                $query->where('bank_name', $bankName)
                      ->orWhereJsonContains('payment_history', ['details' => ['bank_name' => $bankName]]);
            });
        }

        // Apply date filter if provided
        if ($startDate) {
            $archivedSalesQuery->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $archivedSalesQuery->whereDate('created_at', '<=', $endDate);
        }

        $archivedSales = $archivedSalesQuery->get();
        \Log::info('Archived sales count: ' . $archivedSales->count());
        $processSales($archivedSales, 'archived');

        // Log final totals before sending
        \Log::info('FINAL TOTALS BEFORE RESPONSE', [
            'cash' => $totals['cash'],
            'cheque' => $totals['cheque'],
            'bank_transfer' => $totals['bank_transfer'],
            'bag_to_box' => $totals['bag_to_box'],
            'bill_to_bill' => $totals['bill_to_bill'],
            'bad_debt' => $totals['bad_debt'],
            'unique_payments_processed' => count($processedPaymentIds)
        ]);

        // Calculate total income (EXCLUDING CREDIT)
        $totals['total_income'] = $totals['cash'] + $totals['cheque'] + $totals['bank_transfer'] +
            $totals['bag_to_box'] + $totals['bill_to_bill'] + $totals['bad_debt'];

        return response()->json([
            'success' => true,
            'data' => [
                'totals' => $totals,
                'bills' => $billsData,
                'filters' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'unique_code' => $uniqueCode,
                    'bank_name' => $bankName
                ]
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Failed to get income sources: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to get income sources: ' . $e->getMessage()
        ], 500);
    }
}
public function getIncomeFilterOptions(Request $request)
{
    try {
        // Get unique user codes from Sale table
        $saleUsers = Sale::whereNotNull('UniqueCode')
            ->where('UniqueCode', '!=', '')
            ->select('UniqueCode')
            ->distinct()
            ->get()
            ->pluck('UniqueCode')
            ->toArray();

        // Get unique user codes from SalesHistory table
        $historyUsers = SalesHistory::whereNotNull('UniqueCode')
            ->where('UniqueCode', '!=', '')
            ->select('UniqueCode')
            ->distinct()
            ->get()
            ->pluck('UniqueCode')
            ->toArray();

        // Merge and get unique values
        $allUniqueCodes = array_unique(array_merge($saleUsers, $historyUsers));
        sort($allUniqueCodes);

        // Get unique bank names from payment_history in Sale table
        $sales = Sale::all();
        $bankNames = [];

        foreach ($sales as $sale) {
            // Check direct bank_name field
            if ($sale->bank_name) {
                $bankNames[] = $sale->bank_name;
            }

            // Check payment_history JSON
            $paymentHistory = $sale->payment_history;
            if (is_string($paymentHistory)) {
                $paymentHistory = json_decode($paymentHistory, true);
            }

            if (is_array($paymentHistory)) {
                foreach ($paymentHistory as $payment) {
                    // For cheque payments
                    if (isset($payment['method']) && $payment['method'] === 'Cheque' && isset($payment['details']['bank_name'])) {
                        $bankNames[] = $payment['details']['bank_name'];
                    }
                    // For bank transfer payments
                    if (isset($payment['method']) && $payment['method'] === 'Bank Transfer' && isset($payment['details']['bank_account_id'])) {
                        // You might need to fetch bank name from bank_account_id
                        // For now, skip or add logic to get bank name
                    }
                }
            }
        }

        // Also check archived sales
        $archivedSales = SalesHistory::all();
        foreach ($archivedSales as $sale) {
            // Check direct bank_name field
            if ($sale->bank_name) {
                $bankNames[] = $sale->bank_name;
            }

            // Check payment_history JSON
            $paymentHistory = $sale->payment_history;
            if (is_string($paymentHistory)) {
                $paymentHistory = json_decode($paymentHistory, true);
            }

            if (is_array($paymentHistory)) {
                foreach ($paymentHistory as $payment) {
                    if (isset($payment['method']) && $payment['method'] === 'Cheque' && isset($payment['details']['bank_name'])) {
                        $bankNames[] = $payment['details']['bank_name'];
                    }
                }
            }
        }

        $allBankNames = array_unique(array_filter($bankNames));
        sort($allBankNames);

        return response()->json([
            'success' => true,
            'data' => [
                'unique_codes' => $allUniqueCodes,
                'bank_names' => $allBankNames
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Failed to get filter options: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to get filter options: ' . $e->getMessage()  // Changed colon to arrow (=>)
        ], 500);
    }
}
// In your SalesController.php or appropriate controller

/**
 * Get all unique UniqueCode values from sales and sales_history
 */
public function getUniqueCodes()
{
    try {
        $currentUser = auth()->user();

        // Get unique codes from Sale table
        $saleCodes = Sale::select('UniqueCode')
            ->whereNotNull('UniqueCode')
            ->where('UniqueCode', '!=', '');

        // Get unique codes from SalesHistory table
        $historyCodes = SalesHistory::select('UniqueCode')
            ->whereNotNull('UniqueCode')
            ->where('UniqueCode', '!=', '');

        // If user is not admin, filter by their own code
        if ($currentUser && $currentUser->role === 'User') {
            $saleCodes->where('UniqueCode', $currentUser->user_id);
            $historyCodes->where('UniqueCode', $currentUser->user_id);
        }

        $saleCodes = $saleCodes->distinct()->pluck('UniqueCode')->toArray();
        $historyCodes = $historyCodes->distinct()->pluck('UniqueCode')->toArray();

        // Merge and get unique values
        $allCodes = array_unique(array_merge($saleCodes, $historyCodes));
        sort($allCodes);

        return response()->json([
            'success' => true,
            'unique_codes' => $allCodes
        ]);
    } catch (\Exception $e) {
        Log::error('Failed to fetch unique codes: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch unique codes'
        ], 500);
    }
}

/**
 * Get all sales with optional UniqueCode filter
 */
public function getAllSales2(Request $request)
{
    try {
        $currentUser = auth()->user();
        $uniqueCode = $request->get('unique_code');

        $query = Sale::query();

        // Filter by user if not admin
        if ($currentUser && $currentUser->role === 'User') {
            $query->where('UniqueCode', $currentUser->user_id);
        }

        // Filter by selected UniqueCode
        if ($uniqueCode && $uniqueCode !== 'all') {
            $query->where('UniqueCode', $uniqueCode);
        }

        $sales = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'sales' => $sales
        ]);
    } catch (\Exception $e) {
        Log::error('Failed to fetch all sales: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch sales data'
        ], 500);
    }
}

/**
 * Get archived sales with optional UniqueCode filter
 */
public function getArchivedSales2(Request $request)
{
    try {
        $currentUser = auth()->user();
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $uniqueCode = $request->get('unique_code');

        $query = SalesHistory::query();

        // Filter by date range
        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        // Filter by user if not admin
        if ($currentUser && $currentUser->role === 'User') {
            $query->where('UniqueCode', $currentUser->user_id);
        }

        // Filter by selected UniqueCode
        if ($uniqueCode && $uniqueCode !== 'all') {
            $query->where('UniqueCode', $uniqueCode);
        }

        $sales = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'sales' => $sales
        ]);
    } catch (\Exception $e) {
        Log::error('Failed to fetch archived sales: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch archived sales data'
        ], 500);
    }
}
public function getSalesByBillNo($billNo)
{
    try {
        $sales = Sale::where('bill_no', $billNo)->get();

        if ($sales->isEmpty()) {
            return response()->json([], 404);
        }

        // Format the data similar to your other endpoints
        $formattedSales = $sales->map(function ($sale) {
            return [
                'id' => $sale->id,
                'customer_code' => $sale->customer_code,
                'customer_name' => $sale->customer_name,
                'supplier_code' => $sale->supplier_code,
                'item_code' => $sale->item_code,
                'item_name' => $sale->item_name,
                'weight' => (float) $sale->weight,
                'price_per_kg' => (float) $sale->price_per_kg,
                'packs' => (int) $sale->packs,
                'total' => (float) $sale->total,
                'bill_no' => $sale->bill_no,
                'bill_printed' => $sale->bill_printed,
                'SupplierPricePerKg' => (float) ($sale->SupplierPricePerKg ?? 0),
                'SupplierTotal' => (float) ($sale->SupplierTotal ?? 0),
                'CustomerPackCost' => (float) ($sale->CustomerPackCost ?? 0),
                'commission_amount' => (float) ($sale->commission_amount ?? 0),
                'mobile' => $sale->mobile ?? null,
                'created_at' => $sale->created_at,
                'updated_at' => $sale->updated_at,
            ];
        });

        return response()->json($formattedSales);

    } catch (\Exception $e) {
        Log::error('Error fetching sales by bill_no:', [
            'bill_no' => $billNo,
            'error' => $e->getMessage()
        ]);
        return response()->json(['error' => 'Failed to fetch sales'], 500);
    }
}

}
