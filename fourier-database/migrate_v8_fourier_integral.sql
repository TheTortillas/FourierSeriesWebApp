-- Migration v8: add fourier_integral to calculation_type enum
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'fourier_integral';
