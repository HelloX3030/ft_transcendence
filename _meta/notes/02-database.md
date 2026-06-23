## Database

We use PostgreSQL as our database because it is an industry standard and widely adopted across production systems. It is highly optimized for performance, reliability, and scalability, making it suitable for a wide range of applications from small projects to large enterprise systems.

PostgreSQL also provides strong support for advanced SQL features, extensibility, and data integrity, which makes it a solid choice for modern backend architectures.

## Database Layout and Visualization

Our database schema can be viewed in the /backend/prisma folder. If you want a visual overview of the table relationships, you can use https://dbdiagram.io/d to visualize them.

## Prisma Studio

Prisma Studio is a tool that allows you to inspect and interact with database tables over the web. It is very useful for development.

### How do I launch Prisma Studio?
Go to the backend directory and execute the command:

`npx prisma studio --url=postgresql://user:password@localhost:5432/dbname`

That's it!

https://www.prisma.io/docs/studio
