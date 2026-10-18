# Day 7: Scaling a Photo-Sharing App

## 1. Overview

SnapShare is a photo-sharing application that allows users to upload photos, view feeds, and interact with content. The system must support one million daily active users while keeping photo delivery fast, protecting uploaded files, and handling background processing reliably.

The architecture separates application logic, metadata storage, and image storage. It uses a Content Delivery Network (CDN) for efficient image delivery, a cache for frequently requested feed data, database read replicas for scaling reads, and a background queue for thumbnail generation.

## 2. Assumptions and Capacity Estimates

### Assumptions

- Daily active users (DAU): 1,000,000.
- Each active user uploads one photo per day.
- Each active user views 50 feed items per day.
- Average original photo size: 2 MB.
- Average thumbnail size: 50 KB.
- One year: 365 days.
- Peak traffic is estimated at five times average traffic.
- Storage estimates use decimal units and exclude database metadata, indexes, replication, backups, and temporary files.

### Daily uploads

Daily uploads:

1,000,000 users × 1 upload = 1,000,000 uploads per day.

Average uploads per second:

1,000,000 ÷ 86,400 = approximately **11.57 uploads per second**.

### Feed views

Daily feed views:

1,000,000 users × 50 feed views = 50,000,000 feed views per day.

Average feed views per second:

50,000,000 ÷ 86,400 = approximately **578.70 feed views per second**.

Estimated peak feed views per second:

578.70 × 5 = approximately **2,893.52 feed views per second**.

The application is read-heavy, handling approximately 50 feed views for every photo upload. Feed views and image requests therefore need to scale independently from photo uploads.

### Annual image storage

Original photos:

1,000,000 × 2 MB × 365 = 730,000,000 MB, or approximately **730 TB per year**.

Thumbnails:

1,000,000 × 50 KB × 365 = 18,250,000,000 KB, or approximately **18.25 TB per year**.

Total estimated annual image storage:

730 TB + 18.25 TB = approximately **748.25 TB per year**.

These estimates assume that every daily active user uploads one new photo every day. Actual capacity requirements depend on user behavior, image sizes, retention policies, and growth. Replication and backups require additional storage.

## 3. Read and Write Workloads

### Read-heavy operations

- Loading a user's feed.
- Retrieving photo metadata and captions.
- Viewing profiles and photo details.
- Retrieving image thumbnails and original images.

Feed metadata reads can use a cache and database read replicas. Image files should be delivered through a CDN backed by object storage.

### Write-heavy operations

- Creating a photo record.
- Uploading original image files.
- Updating photo-processing status.
- Saving likes, comments, and other interactions.

The primary database handles authoritative metadata writes. Original images and thumbnails are stored in object storage rather than relational database tables.

## 4. Architecture Diagram

```text
                    Mobile / Web Clients
                             |
                            DNS
                             |
                      CDN / Edge Cache
                       |           |
                  Static Assets   Cached Images
                             |
                        Load Balancer
                             |
                  +----------+----------+
                  |                     |
             App Server 1           App Server 2
                  |                     |
                  +----------+----------+
                             |
                    Application Services
                      |      |       |
                      |    Redis     |
                      |    Cache     |
                      |              |
                 +----+----+     Job Queue
                 |         |         |
             Primary DB  Read DB   Thumbnail Workers
                 |       Replica       |
                 |                     |
                 +---- Metadata   Object Storage
                       Records     Originals and
                                   Thumbnails
```

The CDN serves cached images and static assets close to users. Feed metadata requests pass through the application servers, which use the cache and database. Uploads are sent directly to object storage using short-lived, authorized upload URLs.

The job queue and thumbnail workers process images asynchronously, allowing users to upload photos without waiting for thumbnail generation to finish.

## 5. Component Responsibilities

- **Clients:** Web browsers and mobile applications let users upload photos, view feeds, and interact with content.
- **DNS:** Resolves the application's domain name to the appropriate service entry point.
- **CDN:** Caches static assets and eligible images at edge locations to reduce latency and origin traffic.
- **Load balancer:** Distributes API requests across healthy application servers and stops routing traffic to unhealthy instances.
- **Application servers:** Authenticate users, authorize operations, validate requests, issue upload URLs, manage photo metadata, and coordinate background processing.
- **Cache:** Stores frequently requested feed metadata and other reusable data in Redis, reducing repeated database queries.
- **Primary database:** Stores authoritative metadata, including users, photo records, ownership, and processing status.
- **Read replica:** Serves eligible read queries to reduce load on the primary database. Replication lag must be considered.
- **Object storage:** Stores original photos and generated thumbnails durably and independently of database records.
- **Job queue:** Buffers thumbnail-generation jobs so uploads do not have to wait for image processing to finish.
- **Thumbnail workers:** Consume queued jobs, validate and resize images, save thumbnails to object storage, and update photo-processing status in the database.
- **Monitoring and alerts:** Track request latency, error rates, queue depth, worker failures, storage capacity, and database health.

## 6. Photo Upload Flow

The upload process separates receiving the original image from processing it. This reduces application-server load and allows thumbnail generation to be retried independently.

### Step-by-step upload lifecycle

1. **User selects a photo.** The client checks basic constraints, such as the maximum file size and allowed file extensions. These client-side checks improve usability but are not trusted as security controls.

2. **The client requests an upload session.** It sends an authenticated request to the application API with the intended file name, file size, and content type.

3. **The application validates the request.** The server checks the user's identity, permissions, file size, permitted image types, and applicable upload limits. It generates a unique object key and creates a photo metadata record with a status such as `pending_upload`.

4. **The server returns a pre-signed upload URL.** The application issues a short-lived URL restricted to the intended object key and permitted upload operation. The client does not receive general object-storage credentials. Expired URLs can be replaced by requesting a new upload session.

5. **The client uploads the original photo.** The file is sent directly to object storage using the authorized URL. This avoids routing large binary files through application servers and reduces application-server bandwidth usage.

6. **The upload is verified.** After the upload, the client confirms completion with the API, or a trusted object-storage event triggers verification. The server checks that the expected object exists and that its size and actual file format meet the upload policy. Client-supplied file extensions and MIME types alone are not trusted. Once verification succeeds, the photo record is updated to `uploaded`.

7. **A thumbnail job is enqueued.** The application or trusted event handler creates a job containing the photo ID and object key. The job is placed in a durable queue so processing can continue even when workers are temporarily unavailable. To avoid losing jobs if the application crashes after the database update, the system can use a transactional outbox or a reconciliation process that finds uploaded photos without queued processing jobs.

8. **A worker processes the image.** A thumbnail worker claims the job, retrieves the original photo from object storage, and safely decodes the image. It validates the actual format, rejects malformed or unsupported files, enforces image-dimension and resource limits, and generates one or more resized thumbnails.

9. **The worker saves the thumbnail.** The worker writes the generated thumbnail to object storage under a unique object key. Only after the thumbnail has been stored successfully does it update the database with the thumbnail location and set the processing status to `ready`. If processing fails, the record is marked or retained in an appropriate retryable or failed state.

10. **The application updates cached data.** The system expires or invalidates relevant cached feed entries when necessary. Cache updates should happen after the authoritative database update so the application does not advertise a thumbnail that is not yet available.

11. **The client displays the result.** The client polls the photo-status endpoint or receives an update through a suitable notification mechanism. While processing is underway, it can display a processing indicator. Once the status is `ready`, the client displays the photo using its CDN URL.

### Asynchronous thumbnail processing

Thumbnail generation runs separately from the upload request. The original image can be safely stored even if thumbnail workers are busy, allowing the queue to absorb temporary spikes in uploads.

Workers can scale independently according to queue depth and processing time. The system should monitor the age of the oldest queued job, job failure rates, processing duration, and the number of available workers.

### Failure handling and recovery

- **Failed uploads:** The client can retry using a valid upload URL or request a new one if the URL has expired. Incomplete uploads should be cleaned up according to an upload-expiration policy.
- **Worker crashes:** If a worker crashes before acknowledging a job, the queue makes the job available again after its visibility timeout or lease expires.
- **Duplicate jobs:** Processing must be idempotent. Repeated processing of the same photo should not create inconsistent metadata or multiple visible photo records. Stable job identifiers and deterministic or versioned object keys help achieve this.
- **Temporary errors:** Retry recoverable failures using exponential backoff, with a maximum retry count to avoid endless processing attempts.
- **Repeated failures:** Move jobs that exceed the retry limit into a dead-letter queue for investigation and controlled reprocessing.
- **Missing jobs:** A reconciliation task should periodically find photos marked `uploaded` or `processing` that have no completed thumbnail job and safely enqueue the required work.
- **Partial processing:** If a thumbnail is saved but the database update fails, a retry should safely verify or overwrite the expected thumbnail and complete the metadata update.
- **Permanent processing failures:** Keep the original photo safe, record the failure, and allow an authorized retry or reprocessing operation.
- **Orphaned objects:** Use unique object keys, expiration policies for abandoned uploads, and periodic cleanup for objects that no longer have valid database records.

These recovery mechanisms make the upload pipeline resilient to network interruptions, application crashes, duplicate events, and worker failures.

## 7. Architectural Trade-offs

### Trade-off 1: Strong consistency versus eventual consistency

**Option A: Strong consistency**

Read recently written data from the primary database or use a mechanism that confirms the write before returning the updated result.

Advantages:
- Users are more likely to see their own changes immediately.
- Application behavior is easier to reason about.
- Important operations can rely on the latest committed metadata.

Disadvantages:
- More read traffic reaches the primary database.
- Database load and response latency can increase.
- Scaling very high read volumes may become more expensive.

**Option B: Eventual consistency**

Serve many feed reads from caches and read replicas, accepting that updates may take time to appear everywhere.

Advantages:
- Reduces load on the primary database.
- Improves read scalability.
- Supports efficient, high-volume feed delivery.

Disadvantages:
- A new photo or changed metadata may briefly be absent or stale in some feeds.
- Replication lag and cache invalidation introduce additional complexity.

**Decision:** Use cached and replica-backed reads for ordinary feed browsing. For read-after-write operations, read from the primary database or use an appropriate consistency mechanism. Show a processing indicator until the thumbnail is ready rather than presenting an incomplete image as fully available.

### Trade-off 2: Aggressive caching versus data freshness

**Option A: Aggressive caching**

Keep frequently requested feed metadata and thumbnails in caches for longer periods.

Advantages:
- Reduces database queries and object-storage requests.
- Improves response latency.
- Reduces backend traffic during peak demand.

Disadvantages:
- Requires cache capacity and monitoring.
- Can serve stale metadata.
- Cache invalidation adds complexity when photos change or are deleted.

**Option B: Minimal caching**

Retrieve more data from databases and object storage on demand.

Advantages:
- Simpler cache invalidation.
- Metadata can reflect recent changes more quickly.
- Fewer cache-management requirements.

Disadvantages:
- Higher backend traffic.
- Potentially slower responses.
- Increased infrastructure costs under heavy demand.

**Decision:** Cache popular thumbnails at the CDN for longer periods when object keys are immutable or versioned. Use shorter expiration periods and targeted invalidation for mutable feed metadata. Monitor cache hit rates, latency, and stale-data incidents to adjust caching policies.

### Trade-off 3: Direct uploads versus proxy uploads

**Option A: Direct-to-object-storage uploads**

The client uploads the image directly to object storage using a pre-signed URL.

Advantages:
- Reduces application-server bandwidth and processing load.
- Scales well for large files and high upload volumes.
- Separates file transfer from application logic.

Disadvantages:
- Requires secure URL generation and expiration.
- Needs server-side upload verification.
- Requires careful handling of abandoned uploads and storage events.

**Option B: Proxy uploads**

The client sends the image to the application server, which then forwards it to object storage.

Advantages:
- Gives the application server direct control over the upload stream.
- Can simplify certain request-validation workflows.

Disadvantages:
- Consumes application-server bandwidth and resources.
- Can increase latency and infrastructure costs.
- Makes scaling large file transfers more difficult.

**Decision:** Use