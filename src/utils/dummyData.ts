
export const generateDummyCollection = () => {
  return {
    id: 'preview-collection-id',
    title: 'Sample Collection',
    description: 'This is a sample collection for preview purposes.',
    amount: 5000,
    deadline: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
    status: 'active',
    organizer_id: 'dummy-organizer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total_amount: 0,
    form_fields: [
      {
        id: '1',
        name: 'Full Name',
        type: 'text',
        required: true
      },
      {
        id: '2',
        name: 'Email',
        type: 'email',
        required: true
      },
      {
        id: '3',
        name: 'Phone Number',
        type: 'tel',
        required: false
      },
      {
        id: '4',
        name: 'Department',
        type: 'option',
        required: true,
        options: ['Computer Science', 'Engineering', 'Business', 'Medicine', 'Arts']
      },
      {
        id: '5',
        name: 'Student ID',
        type: 'text',
        required: true
      }
    ]
  };
};

export const generateDummyContributions = (collectionId: string) => {
  return [
    {
      id: 'contrib-1',
      collection_id: collectionId,
      contributor_name: 'John Doe',
      contributor_email: 'john@example.com',
      contributor_phone: '08012345678',
      amount: 5000,
      status: 'paid',
      payment_method: 'paystack',
      payment_reference: 'PST-12345',
      created_at: new Date().toISOString(),
    },
    {
      id: 'contrib-2',
      collection_id: collectionId,
      contributor_name: 'Jane Smith',
      contributor_email: 'jane@example.com',
      contributor_phone: '08023456789',
      amount: 10000, // Paid for two people
      status: 'paid',
      payment_method: 'paystack',
      payment_reference: 'PST-67890',
      created_at: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    },
    {
      id: 'contrib-3',
      collection_id: collectionId,
      contributor_name: 'Samuel Wilson',
      contributor_email: 'samuel@example.com',
      contributor_phone: '08034567890',
      amount: 5000,
      status: 'pending',
      payment_method: 'bank_transfer',
      payment_reference: 'BNK-54321',
      created_at: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    }
  ];
};
