
# Day 7: Scaling a Photo-Sharing App

## 1. Overview

SnapShare is a photo-sharing application that allows users to upload photos, view feeds, and interact with content. The system must support one million daily active users while keeping photo delivery fast, protecting uploaded files, and handling background processing reliably.

The architecture separates application logic, metadata storage, and image storage. It uses a CDN for efficient image delivery, a cache for frequently requested feed data, read replicas for database scaling, and a background queue for thumbnail generation.

## 2. Assumptions and Capacity Estimates

Assumptions:

- Daily active users (DAU): 1,000,000.
- Each active user uploads one photo per day.
- Each active user views 50 feed items per day.
- Average original photo size: 2 MB.
- Average thumbnail size: 50 KB.
- One year: 365 days.
- Peak traffic is estimated at five times average traffic.
- Storage estimates use decimal units and exclude database metadata, indexes, replication, backups, and temporary files.

### Daily uploads

1,000,000 users × 1 upload = 1,000,000 uploads per day.

Average uploads per second:

1,000,000 / 86,400 = approximately 11.57 uploads per second.

### Feed views

1,000,000 users × 50 feed views = 50,000,000 feed views per day.

Average feed views per second:

50,000,000 / 86,400 = approximately 578.70 feed views per second.

Estimated peak feed views per second:

578.70 × 5 = approximately 2,893.52 feed views per second.

The application is read-heavy: it handles approximately 50 feed views for every photo upload.

### Annual image storage

Original photos:

1,000,000 × 2 MB × 365 = 730,000,000 MB, or approximately 730 TB per year.

Thumbnails:

1,000,000 × 50 KB × 365 = 18,250,000,000 KB, or approximately 18.25 TB per year.

Total estimated annual image storage:

730 TB + 18.25 TB = approximately 748.25 TB per year.

These figures assume that every daily active user uploads one new photo every day. Actual capacity requirements depend on user behavior, image sizes, retention policies, and growth. Replication and backups require additional storage.

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
- Updating photo processing status.
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
                      |    Cache     |
                      |   (Redis)    |
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

The CDN serves cached images and static assets close to users. Feed metadata requests pass through the application servers, which use the cache and database. Uploads are sent directly to object storage using short-lived, authorized upload URLs. The job queue and thumbnail workers process images asynchronously.

## 5. Component Responsibilities

- **Clients:** Web browsers and mobile applications let users upload photos, view feeds, and interact with content.
- **DNS:** Resolves the application's domain name to the appropriate service entry point.
- **CDN:** Caches static assets and eligible images at edge locations to reduce latency and origin traffic.
- **Load balancer:** Distributes API requests across healthy application servers and stops routing traffic to unhealthy instances.
- **Application servers:** Authenticate users, authorize operations, validate requests, issue upload URLs, manage photo metadata, and coordinate background processing.
- **Cache:** Stores frequently requested feed metadata and other reusable data in Redis, reducing repeated database queries.
- **Primary database:** Stores authoritative metadata, including users, photo records, ownership, and processing status.
- **Read replica:** Serves eligible read queries to reduce load on the primary database; replication lag must be considered.
- **Object storage:** Stores original photos and generated thumbnails durably and independently of database records.
- **Job queue:** Buffers thumbnail-generation jobs so uploads do not have to wait for image processing to finish.
- **Thumbnail workers:** Consume queued jobs, validate and resize images, save thumbnails to object storage, and update photo processing status in the database.
- **Monitoring and alerts:** Track request latency, error rates, queue depth, worker failures, storage capacity, and database health.

## 6. Photo Upload Flow

1. **User selects a photo.** The client checks basic file constraints, such as allowed file types and maximum size, before requesting an upload.

2. **The client requests an upload session.** It sends an authenticated request to the application API with the intended file metadata.

3. **The application validates the request.** The server checks the user's identity, permissions, file size, and permitted image types. It generates a unique object key and creates a photo metadata record with a status such as `pending_upload`.

4. **The server returns an upload URL.** The application issues a short-lived, restricted pre-signed URL for the intended object key. The client does not receive general storage credentials.

5. **The client uploads the original photo.** The file is sent directly to object storage using the authorized URL. This avoids routing large binary files through application servers and reduces application-server bandwidth usage.

6. **The upload is verified.** The client confirms completion with the API, or a trusted storage event triggers verification. The system checks that the object exists and meets the expected constraints. The photo record is updated to `uploaded`.

7. **A thumbnail job is enqueued.** The application or trusted event handler adds a job containing the photo ID and object key to the queue. The queue decouples upload handling from image processing.

8. **A worker processes the image.** A worker claims the job, retrieves the original photo, validates and decodes it safely, and generates one or more resized thumbnails.

9. **The worker saves the thumbnail.** The generated thumbnail is written to object storage under a unique object key. The worker updates the database record with the thumbnail location and changes the processing status to `ready`.

10. **The application invalidates relevant caches.** Any cached feed entries that need to reflect the new photo are expired or invalidated. The feed can now return the photo and its thumbnail URL.

11. **The client displays the result.** The client polls for status or receives an update through a suitable notification mechanism. Once processing is complete, it displays the photo using the CDN URL.

### Failure handling and recovery

- If an upload fails, the client can retry using an unexpired upload URL or request a new one.
- If a worker crashes, the queue makes the job available for retry after the visibility timeout or lease expires.
- Jobs should be idempotent: processing the same photo more than once must not create inconsistent metadata or duplicate visible results.
- Use bounded retries with backoff and a dead-letter queue for jobs that repeatedly fail.
- Monitor queue age and depth, worker errors, and time spent in each photo-processing state.
- Run a reconciliation task to find uploaded objects whose metadata or thumbnail processing is incomplete.
- If thumbnail generation fails permanently, keep the original photo safe, record the failure, and allow retry or reprocessing.
- Use unique object keys and cleanup rules for abandoned uploads and orphaned files.

## 7. Feed Read Flow

1. The client requests the authenticated user's feed.
2. DNS resolves the service domain and the load balancer routes the request to a healthy application server.
3. The application validates the user's identity and permissions.
4. The application checks the cache for feed metadata.
5. On a cache miss, it queries the read replica for eligible feed data, using the primary database when fresh or read-after-write data is required.
6. The application returns paginated photo metadata and thumbnail URLs.
7. The CDN serves cached thumbnails, retrieving missing objects from object storage.
8. The application caches suitable feed results with a defined expiration policy.

Pagination, bounded query sizes, appropriate database indexes, and cache monitoring help control load as the user base grows.

## 8. Architectural Trade-offs

### Trade-off 1: Strong consistency versus eventual consistency

**Option A: Strong consistency**

Read recently written data from the primary database or use a mechanism that confirms the write before returning the updated result.

- Advantages: Users are more likely to see their own changes immediately, and application behavior is easier to reason about.
- Disadvantages: More read traffic reaches the primary database, increasing load and potentially latency.

**Option B: Eventual consistency**

Serve many feed reads from caches and read replicas, accepting that updates may take time to appear everywhere.

- Advantages: Reduces primary database load and improves read scalability.
- Disadvantages: A new photo or changed metadata may briefly be absent or stale in some feeds.

**Decision:** Use cached and replica-backed reads for ordinary feed browsing. For read-after-write operations, fetch from the primary or use a suitable consistency mechanism. Show a processing indicator until the thumbnail is ready rather than presenting an incomplete image as fully available.

### Trade-off 2: Aggressive caching versus cost and freshness

**Option A: Aggressive caching**

Keep frequently requested feed metadata and thumbnails in caches for longer periods.

- Advantages: Reduces database queries, object-storage requests, and response latency.
- Disadvantages: Requires cache capacity, can serve stale metadata, and adds invalidation complexity.

**Option B: Minimal caching**

Retrieve more data from databases and object storage on demand.

- Advantages: Simpler invalidation and fresher metadata.
- Disadvantages: Higher backend traffic, potentially slower responses, and increased infrastructure cost under heavy demand.

**Decision:** Cache popular thumbnails at the CDN for longer periods when object keys are immutable. Use shorter expiration periods and targeted invalidation for mutable feed metadata. Measure cache hit rates and latency before increasing cache size or duration.

### Trade-off 3: Direct-to-object-storage uploads versus proxy uploads

**Direct uploads** reduce application-server bandwidth and scale well for large files, but require secure pre-signed URLs and upload verification.

**Proxy uploads** route the entire file through application servers, which can simplify some validation workflows but consume application bandwidth, memory, and processing capacity.

**Decision:** Use direct uploads with short-lived, restricted URLs, server-side verification, file-size limits, and safe image decoding.

## 9. Reliability, Security, and Scaling

- Run multiple application-server instances across separate availability zones.
- Use health checks and redundant load-balancing infrastructure.
- Deploy highly available database, cache, and queue services where required.
- Maintain automated database backups and regularly test restoration and failover.
- Keep original photos in durable object storage with appropriate replication and lifecycle policies.
- Use HTTPS, authenticated requests, least-privilege access, and short-lived upload URLs.
- Verify file signatures rather than trusting extensions or client-supplied MIME types.
- Apply file-size limits, malware or content checks where appropriate, and safe image-decoding practices.
- Use pagination, database indexes, connection pooling, and rate limiting.
- Monitor latency, error rates, cache hit rates, queue depth, worker retries, and storage growth.
- Load-test expected average and peak traffic and scale application servers and workers independently.
- Set retention and deletion policies that remove associated thumbnails and cached content when photos are deleted.

## 10. Conclusion

SnapShare can scale by separating metadata from image binaries, serving images through a CDN, caching frequent feed reads, and using database read replicas to reduce primary database load. Direct uploads to object storage reduce pressure on application servers, while a durable queue and idempotent workers make thumbnail generation asynchronous and recoverable. The design balances performance, consistency, reliability, and cost while providing a path to scale beyond one million daily active users.
