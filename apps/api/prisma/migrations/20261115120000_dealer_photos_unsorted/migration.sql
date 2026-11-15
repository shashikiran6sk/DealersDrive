-- Photographs uploaded "all at once": no named shot, placed by the review team.
ALTER TYPE "VehiclePhotoSlot" ADD VALUE IF NOT EXISTS 'UNSORTED' BEFORE 'EXTRA';
