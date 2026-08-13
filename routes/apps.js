const express = require("express");
const jwt = require("jsonwebtoken");

const AppSubmission =
    require("../models/AppSubmission");

const router = express.Router();


/* =========================
   AUTH HELPER
========================= */

function getUser(req)
{
    const authHeader =
        req.headers.authorization;

    if (!authHeader)
        return null;


    const token =
        authHeader.replace(
            "Bearer ",
            ""
        );


    try
    {
        return jwt.verify(
            token,
            process.env.JWT_SECRET
        );
    }
    catch
    {
        return null;
    }
}


/* =========================
   SUBMIT APPLICATION
========================= */

router.post("/submit", async (req, res) =>
{
    try
    {
        const user =
            getUser(req);


        if (!user)
        {
            return res.status(401).json({
                error:
                    "Invalid or missing token"
            });
        }


        /*
         * Only allow one pending
         * submission per user.
         */

        const existing =
            await AppSubmission.findOne({
                submittedBy: user.id,
                status: "pending"
            });


        if (existing)
        {
            return res.status(409).json({
                error:
                    "You already have a pending app submission."
            });
        }


        const {
            Title,
            Category,
            Subtitle,
            Publisher,
            ImagePath,
            DetailImagePath,
            Version,
            Framework,
            Description,
            DownloadUrl
        } = req.body;


        /*
         * Required fields
         */

        if (
			!Title ||
			!Category ||
			!Subtitle ||
			!Publisher ||
			!ImagePath ||
			!DetailImagePath ||
			!Version ||
			!Framework ||
			!Description ||
			!DownloadUrl
		)
		{
			return res.status(400).json({
				error:
					"Missing required fields"
			});
		}


        /*
         * Create submission.
         *
         * status is deliberately NOT
         * taken from req.body.
         */

        const submission =
            await AppSubmission.create({

                Title,
                Category,
                Subtitle,
                Publisher,
                ImagePath,
                DetailImagePath,
                Version,
                Framework,
                Description,
                DownloadUrl,

                status: "pending",

                submittedBy:
                    user.id,

                submittedUsername:
                    user.username

            });


        res.status(201).json({

            success: true,

            message:
                "Application submitted for review.",

            submission

        });

    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error:
                err.message
        });
    }
});


/* =========================
   GET OWN SUBMISSION STATUS
========================= */

router.get("/mine", async (req, res) =>
{
    try
    {
        const user =
            getUser(req);


        if (!user)
        {
            return res.status(401).json({
                error:
                    "Invalid or missing token"
            });
        }


        const submissions =
            await AppSubmission.find({
                submittedBy:
                    user.id
            })
            .sort({
                createdAt: -1
            });


        res.json(
            submissions
        );

    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error:
                err.message
        });
    }
});


/* =========================
   GET PENDING SUBMISSIONS
=========================

   This is mainly useful for admins
   who want to inspect submissions
   through the API.

========================= */

router.get("/pending", async (req, res) =>
{
    try
    {
        const user =
            getUser(req);


        if (!user)
        {
            return res.status(401).json({
                error:
                    "Invalid or missing token"
            });
        }


        /*
         * No admin system yet.
         *
         * Keep this endpoint available
         * for now, but you should add
         * an admin check before exposing
         * it publicly.
         */

        const submissions =
            await AppSubmission.find({
                status: "pending"
            })
            .sort({
                createdAt: 1
            });


        res.json(
            submissions
        );

    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error:
                err.message
        });
    }
});


/* =========================
   APPROVE SUBMISSION
========================= */

router.post(
    "/approve/:id",
    async (req, res) =>
{
    try
    {
        const user =
            getUser(req);


        if (!user)
        {
            return res.status(401).json({
                error:
                    "Invalid or missing token"
            });
        }


        const submission =
            await AppSubmission.findById(
                req.params.id
            );


        if (!submission)
        {
            return res.status(404).json({
                error:
                    "Submission not found"
            });
        }


        submission.status =
            "approved";


        await submission.save();


        res.json({

            success: true,

            message:
                "Application approved.",

            submission

        });

    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error:
                err.message
        });
    }
});


/* =========================
   DELETE SUBMISSION
=========================

   For rejection, you can simply
   delete the document from MongoDB.

========================= */

router.delete(
    "/:id",
    async (req, res) =>
{
    try
    {
        const user =
            getUser(req);


        if (!user)
        {
            return res.status(401).json({
                error:
                    "Invalid or missing token"
            });
        }


        const deleted =
            await AppSubmission.findByIdAndDelete(
                req.params.id
            );


        if (!deleted)
        {
            return res.status(404).json({
                error:
                    "Submission not found"
            });
        }


        res.json({

            success: true,

            message:
                "Submission deleted."

        });

    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error:
                err.message
        });
    }
});

/* =========================
   GET SUBMISSION COUNTS
========================= */

router.get("/stats", async (req, res) =>
{
    try
    {
        const approved =
            await AppSubmission.countDocuments({
                status: "approved"
            });

        const pending =
            await AppSubmission.countDocuments({
                status: "pending"
            });

        res.json({
            approved,
            pending
        });
    }
    catch (err)
    {
        console.error(err);

        res.status(500).json({
            error: err.message
        });
    }
});


module.exports = router;