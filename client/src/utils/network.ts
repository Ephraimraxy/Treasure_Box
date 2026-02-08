
export const NETWORKS = [
    { id: 'mtn', name: 'MTN', prefixes: ['0803', '0806', '0703', '0903', '0906', '0813', '0816', '0810', '0814'] },
    { id: 'glo', name: 'GLO', prefixes: ['0805', '0807', '0705', '0815', '0811', '0905'] },
    { id: 'airtel', name: 'Airtel', prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0907'] },
    { id: '9mobile', name: '9mobile', prefixes: ['0809', '0818', '0817', '0909', '0908'] },
];

export const DATA_PLANS = {
    mtn: [
        { id: 'mtn-1gb', name: '1GB SME', price: 300, validity: '30 Days' },
        { id: 'mtn-2gb', name: '2GB SME', price: 600, validity: '30 Days' },
        { id: 'mtn-3gb', name: '3GB SME', price: 900, validity: '30 Days' },
        { id: 'mtn-5gb', name: '5GB SME', price: 1500, validity: '30 Days' },
    ],
    glo: [
        { id: 'glo-1gb', name: '1.05GB', price: 300, validity: '14 Days' },
        { id: 'glo-2.5gb', name: '2.5GB', price: 500, validity: '2 Days' },
        { id: 'glo-5.8gb', name: '5.8GB', price: 1500, validity: '30 Days' },
    ],
    airtel: [
        { id: 'airtel-750mb', name: '750MB', price: 300, validity: '14 Days' },
        { id: 'airtel-1.5gb', name: '1.5GB', price: 1000, validity: '30 Days' },
        { id: 'airtel-3gb', name: '3GB', price: 1500, validity: '30 Days' },
    ],
    '9mobile': [
        { id: '9mob-1gb', name: '1GB', price: 1000, validity: '30 Days' },
        { id: '9mob-2.5gb', name: '2.5GB', price: 2000, validity: '30 Days' },
    ],
};

export const getProvider = (phone: string) => {
    // Remove +234 or 0 prefix
    const cleanPhone = phone.replace('+234', '0').replace(/^0/, '0');
    if (cleanPhone.length < 4) return null;

    const prefix = cleanPhone.substring(0, 4);
    return NETWORKS.find(n => n.prefixes.includes(prefix)) || null;
};
