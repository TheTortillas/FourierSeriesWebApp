-- Migration v9: add Laplace transform types to calculation_type enum
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'laplace_direct';
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'laplace_inverse';
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'laplace_ode';
