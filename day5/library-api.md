# Library Books REST API

This API manages books in a library system. The main resource is `books`.

## 1. List all books

- **Method:** GET
- **Path:** `/books`
- **Description:** Returns a list of all books.
- **Success status:** `200 OK`

### Example request

    GET /books

---

## 2. Get one book

- **Method:** GET
- **Path:** `/books/:id`
- **Description:** Returns a single book using its unique ID.
- **Success status:** `200 OK`

### Example request

    GET /books/42

---

## 3. Create a book

- **Method:** POST
- **Path:** `/books`
- **Description:** Creates a new book in the library.
- **Success status:** `201 Created`

### Example request

    POST /books

### Example request body

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "year": 1958
    }

---

## 4. Update a book

- **Method:** PUT
- **Path:** `/books/:id`
- **Description:** Updates an existing book using its unique ID.
- **Success status:** `200 OK`

### Example request

    PUT /books/42

### Example request body

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "year": 1958
    }

---

## 5. Delete a book

- **Method:** DELETE
- **Path:** `/books/:id`
- **Description:** Deletes an existing book using its unique ID.
- **Success status:** `204 No Content`

### Example request

    DELETE /books/42

---

## 6. List books by author

- **Method:** GET
- **Path:** `/books?author=:author`
- **Description:** Returns books written by the specified author using a query parameter.
- **Success status:** `200 OK`

### Example request

    GET /books?author=Chinua%20Achebe

---

# Error Codes

## 400 Bad Request

A `400 Bad Request` response occurs when the client sends invalid or incomplete data.

### Example

A client attempts to create a book without providing the required title.

    POST /books

    {
      "author": "Chinua Achebe",
      "year": 1958
    }

The server can respond with:

    400 Bad Request

## 404 Not Found

A `404 Not Found` response occurs when the requested book does not exist.

### Example

A client requests a book with an ID that does not exist.

    GET /books/9999

The server can respond with:

    404 Not Found
## 422 Unprocessable Entity

A `422 Unprocessable Entity` response occurs when the request is syntactically valid, but the data violates a business or domain rule.

### Example

A client attempts to create a book using an ISBN that already exists in the library:

    POST /books

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "year": 1958,
      "isbn": "9780385474542"
    }

If that ISBN already belongs to another book, the server can respond with:

    422 Unprocessable Entity

The response may explain that the ISBN must be unique.

## 500 Internal Server Error

A `500 Internal Server Error` response occurs when the server encounters an unexpected problem while processing a valid request.

### Example

A client sends a valid request to create a book, but the server experiences an unexpected database failure:

    POST /books

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "year": 1958,
      "isbn": "9780385474542"
    }

The server can respond with:

    500 Internal Server Error