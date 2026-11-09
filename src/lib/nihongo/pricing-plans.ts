export type PricingPlanCode = 'monthly' | 'half_year' | 'annual';

export type PricingPlan = {
  id: 'monthly' | 'half-year' | 'annual';
  code: PricingPlanCode;
  name: string;
  price: string;
  period: string;
  monthly: string;
  billing: string;
  note: string;
  featured: boolean;
  label: string;
};

/** One source of truth for the plan content shown on both public and signed-in pages. */
export const pricingPlans: PricingPlan[] = [
  {
    id: 'monthly',
    code: 'monthly',
    name: 'Monthly',
    price: '₹149',
    period: '/ month',
    monthly: '₹149',
    billing: 'Billed ₹149 every month',
    note: 'Flexible access, month to month.',
    featured: false,
    label: 'STAY FLEXIBLE',
  },
  {
    id: 'half-year',
    code: 'half_year',
    name: '6 Months',
    price: '₹809',
    period: '/ 6 months',
    monthly: '₹134.83',
    billing: 'Billed ₹809 once every 6 months',
    note: 'Save ₹85 compared with six monthly payments.',
    featured: false,
    label: 'BUILD YOUR RHYTHM',
  },
  {
    id: 'annual',
    code: 'annual',
    name: 'Annual',
    price: '₹1,599',
    period: '/ year',
    monthly: '₹133.25',
    billing: 'Billed ₹1,599 once a year',
    note: 'Save ₹189 compared with twelve monthly payments.',
    featured: true,
    label: 'BEST LONG-TERM VALUE',
  },
];
