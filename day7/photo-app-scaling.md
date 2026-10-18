# Day 7: Scaling SnapShare

## 1. Assumptions

SnapShare is a photo-sharing application where users upload photos and view a feed containing photos from people they follow.

The following assumptions are used:

- There are 10 million registered users.
- 10% of registered users are active each day.
- Each daily active user uploads one photo per day.
- Each daily active user views 50 feed pages per day.
- Each original photo averages 2 MB.
- Each photo generates one thumbnail averaging 50 KB.
- A day has 86,400 seconds, and a year has 365 days.
- Storage calculations use decimal units: 1 TB = 1,000,000 MB.
- Peak feed traffic is estimated at five times the average traffic.
- All uploaded photos are retained for one year, and storage calculations exclude backups, replication, and metadata.

### Daily active users

Daily active users (DAU) are calculated as:

10,000,000 × 10% = **1,000,000 daily active users**

## 2. Traffic and storage estimates

### Photo uploads

Each daily active user uploads one photo per day.

- Uploads per day: 1,000,000 × 1 = 1,000,000 uploads.
- Average uploads per second: 1,000,000 ÷ 86,400 = approximately **11.57 uploads per second**.

### Feed views

Each daily active user views 50 feed pages per day.

- Feed views per day: 1,000,000 × 50 = 50,000,000 views.
- Average feed views per second: 50,000,000 ÷ 86,400 = approximately **578.70 views per second**.
- Peak feed views per second: 578.70 × 5 = approximately **2,894 views per second**.

These are average and estimated peak rates. Real traffic can vary by time of day and user activity.

### Photo storage per year

SnapShare receives 1,000,000 photos daily.

- Photos per year: 1,000,000 × 365 = 365,000,000 photos.
- Original photo storage: 365,000,000 × 2 MB = 730,000,000 MB = **730 TB per year**.
- Thumbnail storage: 365,000,000 × 50 KB = 18,250,000,000 KB = **18.25 TB per year**.
- Total new photo and thumbnail storage: 730 TB + 18.25 TB = **748.25 TB per year**.

This estimate excludes backups, replicas, metadata, and storage overhead.

## 3. Read-heavy or write-heavy?

SnapShare is a **read-heavy system** because users generate approximately 50 million feed views per day but only 1 million photo uploads per day. Feed views occur about 50 times as often as uploads.

This means the architecture should optimize for fast feed delivery. A CDN can serve frequently requested images, a cache can reduce repeated database queries, and a read replica can handle read queries without placing all the pressure on the primary database. Load balancing and additional application servers can help handle increased traffic.

## 4. Why photos should not be stored inside the database

Original photos and thumbnails should be stored in **object storage**, while the database stores information about each photo, such as its ID, owner, caption, timestamp, object-storage key, and thumbnail location.

Storing large photo files directly in the database would increase database size, backups, and query overhead. Object storage is designed for large files and can scale independently from the database. A CDN can then cache and deliver those files to users efficiently.

## 5. SnapShare architecture diagram

```text
                         USERS
                           |
                           v
                    +-------------+
                    |     CDN     |
                    | Cached media|
                    +-------------+
                           |
                           v
                    +-------------+
                    |Load Balancer|
                    +-------------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
         +---------+  +---------+  +---------+
         |  App 1  |  |  App 2  |  |  App N  |
         | Server  |  | Server  |  | Server  |
         +---------+  +---------+  +---------+
              |            |            |
              +------------+------------+
                           |
                +----------+----------+
                |                     |
                v                     v
          +-----------+         +-----------+
          |   Cache   |         |  Primary  |
          | Feed/data |         | Database  |
          +-----------+         +-----------+
                                      |
                                      | Replication
                                      v
                                +-----------+
                                | Read      |
                                | Replica   |
                                +-----------+

          Photo upload and thumbnail processing:

              App Servers
                   |
                   v
            +--------------+
            | Object       |
            | Storage      |
            | Original     |
            | Photos       |
            +--------------+
                   |
                   v
            +--------------+
            | Job Queue    |
            +--------------+
                   |
                   v
            +--------------+
            | Thumbnail    |
            | Worker       |
            +--------------+
                   |
                   v
            +--------------+
            | Object       |
            | Storage      |
            | Thumbnails   |
            +--------------+
                   |
                   v
                  CDN
```

The diagram shows the main components and the thumbnail-processing path. The CDN serves cached images, while application requests pass through the load balancer to the application servers.

## 6. What each component does

- **CDN:** Caches and delivers photos and thumbnails from locations close to users, reducing latency and load on the origin storage.
- **Load balancer:** Distributes incoming requests across application servers so that one server does not handle all traffic.
- **Application servers:** Handle authentication, photo-upload requests, feed generation, business rules, and communication with other services.
- **Cache:** Stores frequently requested feed data and metadata to reduce repeated database queries and improve response times.
- **Primary database:** Stores persistent application data such as users, follows, captions, and photo metadata.
- **Read replica:** Handles read queries to reduce the workload on the primary database, while accepting that replicated data may be slightly delayed.
- **Object storage:** Stores original photos and generated thumbnails without placing large binary files inside the relational database.
- **Job queue:** Holds thumbnail-generation jobs so that uploads can complete without waiting for image processing.
- **Thumbnail worker:** Processes queued jobs, creates smaller image versions, and stores the thumbnails in object storage.

## 7. Photo upload flow

1. A user selects a photo and submits an upload request to SnapShare.
2. The load balancer forwards the request to an available application server.
3. The application server authenticates the user and validates the request, including file type and size.
4. The original photo is uploaded to object storage, where it receives a unique storage key.
5. The application records the photo metadata and storage key in the primary database.
6. The application places a thumbnail-generation job on the queue.
7. The application returns a successful response to the user once the original photo and required metadata have been saved and the job has been queued.
8. A background worker retrieves the job and generates a 50 KB thumbnail from the original photo.
9. The worker stores the thumbnail in object storage and updates the photo metadata with its thumbnail location if needed.
10. The CDN caches and serves the original photo and thumbnail when users request them.

If thumbnail processing fails, the job can be retried without requiring the user to upload the original photo again.

## 8. Trade-offs

### Trade-off 1: Caching versus data freshness

Caching feed data improves performance and reduces database load. However, cached feeds may briefly show outdated information after a new photo is uploaded or a user follows someone new. Cache expiration and invalidation policies help balance freshness and speed.

### Trade-off 2: Read replicas versus consistency

Read replicas improve read capacity and reduce pressure on the primary database. However, replication can lag, meaning a recently uploaded photo may not immediately appear in a feed served from a replica. The application can read recent changes from the primary database when stronger consistency is needed.

### Trade-off 3: Asynchronous thumbnails versus immediate availability

Using a queue and background worker allows photo uploads to finish quickly and isolates image processing from the upload request. However, thumbnails are not available immediately, and failed jobs require monitoring and retries. The interface can show the original image or a processing placeholder until the thumbnail is ready.

### Trade-off 4: Object storage and CDN versus cost and complexity

Object storage and a CDN scale well for large amounts of media and reduce delivery latency. However, they introduce additional services, storage and bandwidth costs, permissions to manage, and cache invalidation concerns.

## Conclusion

SnapShare should use a read-optimized architecture with horizontally scalable application servers, caching, a database read replica, object storage for media, and asynchronous thumbnail processing. Based on the given assumptions, the system supports approximately 579 average feed views per second, 2,894 peak feed views per second, and 748.25 TB of new photo and thumbnail storage per year before backups and other overhead.