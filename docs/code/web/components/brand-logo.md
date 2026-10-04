# web / components / brand-logo

Parent: [components](README.md)

The square PNGs share one contour traced from the supplied reference. The
component selects the background variant explicitly from the surrounding
surface, sets width and height before loading, and keeps the reference's
rounded tile at every size. It uses the public optimized PNG directly to
avoid an image-optimizer request for a small static mark.

The default 30 px square replaces the old Plate mark. Admin navigation and
GalleryViewer preserve their 29 × 23 px badge slots with a centered 23 px
square. Nearby words remain unchanged. The image alt text is “Dealers Drive”.

The app has fixed light page surfaces and two dark consumers; it has no
page-wide theme toggle or scrolling background change. Choose `variant`
from the surface when adding a consumer. Dealer-specific LogoTile initials
are business identities, and are not the platform logo.
