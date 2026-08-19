const express = require("express");
const jwt = require("jsonwebtoken");

const AppSubmission =
    require("../models/AppSubmission");

const router = express.Router();


/* =========================
   DISCORD SUBMISSION EMBED
========================= */

async function sendSubmissionEmbed(submission)
{
    const webhookUrl =
        process.env.DISCORD_WEBHOOK_URL;


    if (!webhookUrl)
    {
        console.log(
            "Discord webhook URL not configured."
        );

        return;
    }


    try
    {
        const response =
            await fetch(
                webhookUrl,
                {
                    method:
                        "POST",

                    headers:
                    {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            embeds:
                            [
                                {
                                    title:
                                        "New WebStore Application Submitted",

                                    description:
                                        submission.Description,

                                    fields:
                                    [
                                        {
                                            name:
                                                "Application",

                                            value:
                                                submission.Title,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Publisher",

                                            value:
                                                submission.Publisher,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Version",

                                            value:
                                                submission.Version,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Category",

                                            value:
                                                submission.Category,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Framework / OS",

                                            value:
                                                submission.Framework,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Submitted By",

                                            value:
                                                submission.submittedUsername,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Status",

                                            value:
                                                "Pending Review",

                                            inline:
                                                true
                                        }
                                    ],

                                    thumbnail:
                                    {
                                        url:
                                            submission.ImagePath
                                    },

                                    image:
                                    {
                                        url:
                                            submission.DetailImagePath
                                    },

                                    footer:
                                    {
                                        text:
                                            "Geek Devs Community • WebStore"
                                    },

                                    timestamp:
                                        new Date()
                                            .toISOString()
                                }
                            ]

                        })
                }
            );


        if (!response.ok)
        {
            console.error(
                "Discord webhook failed:",
                response.status
            );
        }
    }
    catch (err)
    {
        console.error(
            "Failed to send Discord submission embed:",
            err
        );
    }
}


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
   URL VALIDATOR
========================= */

function isValidUrl(value)
{
    try
    {
        const url =
            new URL(value);


        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    }
    catch
    {
        return false;
    }
}


/* =========================
   SUBMIT APPLICATION
========================= */

router.post(
    "/submit",
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


        /*
         * Read submitted fields.
         */

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
         * Required fields.
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
         * Validate application
         * icon URL.
         */

        if (!isValidUrl(ImagePath))
        {
            return res.status(400).json({
                error:
                    "Application icon URL is invalid."
            });
        }


        /*
         * Validate screenshot
         * URL.
         */

        if (!isValidUrl(DetailImagePath))
        {
            return res.status(400).json({
                error:
                    "Screenshot URL is invalid."
            });
        }


        /*
         * Validate download
         * URL.
         */

        if (!isValidUrl(DownloadUrl))
        {
            return res.status(400).json({
                error:
                    "Download URL is invalid."
            });
        }


        /*
         * Create submission.
         *
         * Users can submit multiple
         * applications.
         *
         * Multiple pending submissions
         * are allowed.
         *
         * Status is always forced
         * to pending.
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

                status:
                    "pending",

                submittedBy:
                    user.id,

                submittedUsername:
                    user.username

            });


        /*
         * Send Discord notification.
         */

        await sendSubmissionEmbed(
            submission
        );


        /*
         * Return success.
         */

        res.status(201).json({

            success:
                true,

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
   GET OWN SUBMISSIONS
========================= */

router.get(
    "/mine",
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


        const submissions =
            await AppSubmission.find({
                submittedBy:
                    user.id
            })
            .sort({
                createdAt:
                    -1
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
========================= */

router.get(
    "/pending",
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


        /*
         * TODO:
         *
         * Add administrator
         * permission check here.
         */

        const submissions =
            await AppSubmission.find({
                status:
                    "pending"
            })
            .sort({
                createdAt:
                    1
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


        /*
         * TODO:
         *
         * Add administrator
         * permission check here.
         */

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

            success:
                true,

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


        /*
         * TODO:
         *
         * Add administrator
         * permission check here.
         */

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

            success:
                true,

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

router.get(
    "/stats",
    async (req, res) =>
{
    try
    {
        const approved =
            await AppSubmission.countDocuments({
                status:
                    "approved"
            });


        const pending =
            await AppSubmission.countDocuments({
                status:
                    "pending"
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
            error:
                err.message
        });
    }
});


module.exports =
    router;