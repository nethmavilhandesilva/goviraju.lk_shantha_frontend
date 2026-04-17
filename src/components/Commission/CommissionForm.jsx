import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';

const defaultFormData = {
    item_code: '',
    item_name: '',
    supplier_code: '',
    supplier_name: '',
    starting_price: '',
    end_price: '',
    commission_amount: '',
};

const CommissionForm = ({ itemOptions, supplierOptions = [], initialData, onSubmissionSuccess, onCancelEdit }) => {
    
    const [formData, setFormData] = useState(defaultFormData);
    const [status, setStatus] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [isPasswordVerified, setIsPasswordVerified] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    
    const [selectByType, setSelectByType] = useState(initialData ? 
        (initialData.item_code ? 'Items' : initialData.supplier_code ? 'Suppliers' : 'All') : 'Items');
    
    const isEditing = !!initialData;
    // Form is now always unlocked by default
    const isUnlocked = true; 

    const formRefs = {
        select_by_type: useRef(null), 
        item_selector: useRef(null),
        supplier_selector: useRef(null), 
        starting_price: useRef(null),
        end_price: useRef(null),
        commission_amount: useRef(null),
        submit_button: useRef(null),
        password_input: useRef(null),
    };

    useEffect(() => {
        if (initialData) {
            const type = initialData.item_code ? 'Items' : initialData.supplier_code ? 'Suppliers' : 'All';
            setSelectByType(type);
            setFormData({
                item_code: initialData.item_code || '',
                item_name: initialData.item_name || '',
                supplier_code: initialData.supplier_code || '',
                supplier_name: initialData.supplier_name || '',
                starting_price: initialData.starting_price || '',
                end_price: initialData.end_price || '',
                commission_amount: initialData.commission_amount || '',
            });
        } else {
            setFormData(defaultFormData);
            setSelectByType('Items'); 
        }
    }, [initialData]);

    const handleSelectByTypeChange = (e) => {
        if (!isPasswordVerified) {
            setShowPasswordPrompt(true);
            return;
        }
        const newType = e.target.value;
        setSelectByType(newType);
        setFormData(prevData => ({
            ...prevData,
            item_code: '',
            item_name: '',
            supplier_code: '',
            supplier_name: '',
        }));
    };

    const verifyPassword = () => {
        if (passwordInput === 'nethma123') {
            setIsPasswordVerified(true);
            setShowPasswordPrompt(false);
            setPasswordInput('');
            setStatus('✅ Password verified! You can now edit fields.');
            setTimeout(() => setStatus(''), 3000);
        } else {
            setStatus('❌ Incorrect password!');
            setPasswordInput('');
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const handlePasswordKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyPassword();
        }
    };

    const handleChange = (e) => {
        if (!isPasswordVerified) {
            setShowPasswordPrompt(true);
            return;
        }
        const { name, value } = e.target;
        let newFormData = { ...formData };
        
        if (name === 'item_selector') {
            const selectedItem = itemOptions.find(item => item.item_code === value);
            newFormData.item_code = selectedItem ? selectedItem.item_code : '';
            newFormData.item_name = selectedItem ? selectedItem.item_name : '';
        } else if (name === 'supplier_selector') {
            const selectedSupplier = supplierOptions.find(supplier => supplier.code === value);
            newFormData.supplier_code = selectedSupplier ? selectedSupplier.code : '';
            newFormData.supplier_name = selectedSupplier ? selectedSupplier.name : '';
        } else {
            newFormData[name] = value;
        }
        setFormData(newFormData);
    };

    const handleKeyDown = (e, currentFieldName) => {
        if (!isPasswordVerified) {
            setShowPasswordPrompt(true);
            e.preventDefault();
            return;
        }
        
        if (e.key === 'Enter') {
            e.preventDefault(); 

            // Removed 'form_password' from the focus order
            let currentInputOrder = ['select_by_type'];
            if (selectByType === 'Items') {
                currentInputOrder.push('item_selector');
            } else if (selectByType === 'Suppliers') {
                 currentInputOrder.push('supplier_selector');
            }
            currentInputOrder.push('starting_price', 'end_price', 'commission_amount');
            
            const currentIndex = currentInputOrder.indexOf(currentFieldName);

            if (currentFieldName === 'commission_amount') {
                formRefs.submit_button.current.click(); 
            } else {
                const nextFieldName = currentInputOrder[currentIndex + 1];
                if (formRefs[nextFieldName]?.current) {
                    formRefs[nextFieldName].current.focus();
                }
            }
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault(); 

        if (!isPasswordVerified) {
            setShowPasswordPrompt(true);
            return;
        }

        setStatus('Submitting...');
        let payload = {
            starting_price: formData.starting_price,
            end_price: formData.end_price,
            commission_amount: formData.commission_amount,
        };

        if (selectByType === 'Items') {
            if (!formData.item_code) return setStatus('Please select an Item.');
            payload.item_code = formData.item_code;
        } else if (selectByType === 'Suppliers') {
            if (!formData.supplier_code) return setStatus('Please select a Supplier.');
            payload.supplier_code = formData.supplier_code;
        } 
        
        try {
            const endpoint = `/commissions${isEditing ? '/' + initialData.id : ''}`;
            if (isEditing) {
                await api.patch(endpoint, payload);
            } else {
                await api.post(endpoint, payload);
                setFormData(defaultFormData); 
            }
            const message = `✅ Success!`;
            setStatus(message);
            onSubmissionSuccess(message); 
        } catch (error) {
            setStatus(`❌ Failed.`);
        }
    };

    const handleFocus = (e) => {
        if (!isPasswordVerified && !showPasswordPrompt) {
            setShowPasswordPrompt(true);
            e.target.blur();
        }
    };

    // Styling
    const inputStyle = { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' };
    const disabledInputStyle = { ...inputStyle, backgroundColor: '#f5f5f5', cursor: 'not-allowed' };

    return (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', justifyContent: 'space-between' }}>
                <h3 style={{ color: '#004d00', margin: 0 }}>
                    {isEditing ? '✏️ කමිෂන් සංස්කරණය කරන්න' : '➕ නව කමිෂන් සකසන්න'}
                </h3>
                {!isPasswordVerified && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="password"
                            placeholder="Enter password to edit"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            onKeyDown={handlePasswordKeyDown}
                            ref={formRefs.password_input}
                            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '200px' }}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={verifyPassword}
                            style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Verify
                        </button>
                    </div>
                )}
                {isPasswordVerified && (
                    <div style={{ color: 'green', fontSize: '14px', fontWeight: 'bold' }}>
                        ✓ Edit Mode Active
                    </div>
                )}
            </div>

            {showPasswordPrompt && !isPasswordVerified && (
                <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px', 
                    backgroundColor: '#fff3cd', 
                    border: '1px solid #ffc107', 
                    borderRadius: '4px',
                    color: '#856404'
                }}>
                    ⚠️ Please enter the password to enable editing
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '10px' }}>
                
                {/* Select By Type */}
                <div>
                    <label>තෝරන්න:</label>
                    <select
                        name="select_by_type"
                        value={selectByType} 
                        onChange={handleSelectByTypeChange}
                        onKeyDown={(e) => handleKeyDown(e, 'select_by_type')} 
                        disabled={isEditing || !isPasswordVerified} 
                        ref={formRefs.select_by_type} 
                        style={!isPasswordVerified ? disabledInputStyle : inputStyle}
                        onFocus={handleFocus}
                    >
                        <option value="Items">Items</option>
                        <option value="Suppliers">Suppliers</option>
                        <option value="All">All (Global)</option>
                    </select>
                </div>
                
                {/* Conditional Selector */}
                {(selectByType === 'Items' || selectByType === 'Suppliers') && (
                    <div>
                        <label>{selectByType === 'Items' ? 'Item:' : 'Supplier:'}</label>
                        <select
                            name={selectByType === 'Items' ? 'item_selector' : 'supplier_selector'}
                            value={selectByType === 'Items' ? formData.item_code : formData.supplier_code} 
                            onChange={handleChange}
                            onKeyDown={(e) => handleKeyDown(e, selectByType === 'Items' ? 'item_selector' : 'supplier_selector')} 
                            disabled={isEditing || !isPasswordVerified} 
                            ref={selectByType === 'Items' ? formRefs.item_selector : formRefs.supplier_selector} 
                            style={!isPasswordVerified ? disabledInputStyle : inputStyle}
                            onFocus={handleFocus}
                        >
                            <option value="">-- තෝරන්න --</option>
                            {(selectByType === 'Items' ? itemOptions : supplierOptions).map((opt) => (
                                <option key={opt.item_code || opt.code} value={opt.item_code || opt.code}>
                                    {opt.item_code || opt.code} - {opt.item_name || opt.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Price and Commission Fields */}
                <div>
                    <label>ආරම්භක මිල:</label>
                    <input
                        type="number"
                        name="starting_price"
                        value={formData.starting_price}
                        onChange={handleChange}
                        onKeyDown={(e) => handleKeyDown(e, 'starting_price')}
                        ref={formRefs.starting_price}
                        style={!isPasswordVerified ? disabledInputStyle : inputStyle}
                        onFocus={handleFocus}
                        disabled={!isPasswordVerified}
                    />
                </div>

                <div>
                    <label>අවසාන මිල:</label>
                    <input
                        type="number"
                        name="end_price"
                        value={formData.end_price}
                        onChange={handleChange}
                        onKeyDown={(e) => handleKeyDown(e, 'end_price')}
                        ref={formRefs.end_price}
                        style={!isPasswordVerified ? disabledInputStyle : inputStyle}
                        onFocus={handleFocus}
                        disabled={!isPasswordVerified}
                    />
                </div>

                <div>
                    <label>මුදල (Rs):</label>
                    <input
                        type="number"
                        name="commission_amount" 
                        value={formData.commission_amount}
                        onChange={handleChange}
                        onKeyDown={(e) => handleKeyDown(e, 'commission_amount')}
                        ref={formRefs.commission_amount}
                        style={!isPasswordVerified ? disabledInputStyle : inputStyle}
                        onFocus={handleFocus}
                        disabled={!isPasswordVerified}
                    />
                </div>

                {/* Buttons */}
                <div style={{ alignSelf: 'end', display: 'flex', gap: '5px' }}>
                    <button 
                        type="submit" 
                        ref={formRefs.submit_button}
                        disabled={!isPasswordVerified}
                        style={{ 
                            padding: '10px 15px', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            backgroundColor: !isPasswordVerified ? '#6c757d' : (isEditing ? '#ffc107' : '#28a745'),
                            cursor: !isPasswordVerified ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isEditing ? 'Save' : 'එකතු කරන්න'}
                    </button>
                    {isEditing && (
                        <button type="button" onClick={onCancelEdit} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>
            {status && <p style={{ marginTop: '10px', color: status.includes('✅') ? 'green' : status.includes('❌') ? 'red' : 'blue' }}>{status}</p>}
        </div>
    );
};

export default CommissionForm;