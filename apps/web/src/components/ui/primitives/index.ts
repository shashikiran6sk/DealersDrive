/**
 * The primitives. Nothing here knows what a vehicle is — anything that imports
 * a domain type belongs in `components/vehicle/` instead, which is what keeps
 * `ui/` promotable to `packages/ui` later (ARCHITECTURE §16.4).
 */
export { Avatar, type AvatarProps } from './avatar';
export { Banner, type BannerProps, type BannerTone } from './banner';
export { Blueprint, type BlueprintElement, type BlueprintProps } from './blueprint';
export { Corners } from './corners';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { DEFAULT_ERROR_TITLE, ErrorState, type ErrorStateProps } from './error-state';
export { ImageSlot, type ImageSlotProps } from './image-slot';
export { LogoTile, type LogoTileProps } from './logo-tile';
export { Plate, type PlateProps } from './plate';
export { SkeletonLines } from './skeleton-lines';
export { StatCard, type StatCardProps } from './stat-card';
export { StatusTag, type StatusTagProps } from './status-tag';
export { Stepper, type StepperProps } from './stepper';
export { Tag, type TagProps, type TagVariant } from './tag';
