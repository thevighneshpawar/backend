import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefreshToken = async(userId)=>{
  try {
    // console.log(userId);
    
    const user  = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    // console.log(accessToken);
    // console.log("1====");
    
    
    const refreshToken = user.generateRefreshToken()
    // console.log(refreshToken);
    // console.log("2===");
    

    user.refreshToken = refreshToken
    // console.log("done");
    
    await user.save({ validateBeforeSave: false})
    // console.log("Done Done");
    
    
    return {accessToken,refreshToken}


  } catch (error) {
    throw new ApiError(500,"Something went wrong while generating token")
  }
}


const registerUser = asyncHandler(async (req, res) => {
  //get user detail from frontend
  //validation - not empty
  //check if user already exist :username,email check
  //check for images ,check for avatar
  // upload them to cloudinary,avatar
  // create user object - create entry in db
  // remove pass and refresh token from response
  // check for user creation
  // return response

  const { fullName, email, username, password } = req.body;
  //  console.log(req.body);

  //    if(fullname === ""){
  //     throw new ApiError(400,"fullname is required")
  //    }
  if (
    [fullName, email, username, password].some(field => field?.trim() === "")
  ) {
    throw new ApiError(400, "fullname is required");
  }

  const existeduser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existeduser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  //  console.log("Files : ",req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //  console.log("Cloudinary ::" , avatar);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req,res)=>{
    //get user detail from frontend
    //username or email
   // find user
   // password check
    // access and refresh token 
    // send cookie 

    const {email,username, password} =req.body


    if (!username && !email) {
      throw new ApiError(400, "username or email is required")
  }
  
  // Here is an alternative of above code based on logic discussed in video:
  // if (!(username || email)) {
  //     throw new ApiError(400, "username or email is required")
      
  // }

    const user = await User.findOne({
      $or:[{ username }, { email }],
    })

    if(!user){
      throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid= await user.isPasswordCorrect(password)
    
    if(!isPasswordValid){
      throw new ApiError(401,"Invalid user credentials")
    }

   const {accessToken,refreshToken}=  await generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  // options help to cookies are modified only on server
  const options = {
    httpOnly : true,
    secure:process.env.NODE_ENV === 'production'
  }

  return res.status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,accessToken,
        refreshToken
      },
      "User Logged In Successfully"
    )
  )

  })

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
      req.user._id,
      // updating refresh token
      {
        $set:{
          refreshToken:undefined
        }
      },

      // to get new value as undefined
      {
        new:true
      }
    )

    const options = {
      httpOnly : true,
      secure:process.env.NODE_ENV === 'production'
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out"))

  })

const refreshAccessToken = asyncHandler(async (req, res) =>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
      throw new ApiError(401,"unauthorized request")
    }

   try {
     const decodedToken = jwt.verify(
       incomingRefreshToken, 
       process.env.REFRESH_TOKEN_SECRET
     )
     const user = await User.findById(decodedToken?._id)
     if(!user) {
       throw new ApiError(401,"Invalid refresh token")
     }
 
     if(incomingRefreshToken !== user?.refreshToken){
       throw new ApiError(401,"Refresh Token is used ")
     }
 
     const options = {
       httpOnly : true,
       secure:process.env.NODE_ENV === 'production'
     }
 
     const {accessToken,newrefreshToken} = await generateAccessAndRefreshToken(user._id)
 
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newrefreshToken,options)
     .json{
 
       new ApiResponse(
         200,
         {accessToken,refreshToken:newrefreshToken},
         "Access token refreshed",
       )
     }
   } catch (error) {
      throw new ApiError(401,error?.message || "Invalid refresh token")
   }

    
  })

const changeCurrentPassword = asyncHandler( async(req,res)=>{
      const {oldPassword,newPassword} = req.body

      const user = await User.findById(req.user?._id)

      const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

      if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")
      }

      user.password = newPassword
      await user.save({validateBeforeSave: false})

      return res
      .status(200)
      .json(new ApiResponse(200,{},"Password Changed Successfully "))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName,email} = req.body
  // if updating file write different controller for files

  if(!fullName || !email){
    throw new ApiError(400,"All fields are required")
  }

   const user =await   User.findByIdAndUpdate(
      req.user?._id,
      {
          $set:{
            fullName:fullName,
            email:email
          }
      },
      {new:true} //it will return the updated information
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Information updated"))
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,"Error while uploading file")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true} //it will return the updated information
  ).select("-password")


  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"avatar image updated")
  )
})


const updateUsercoverImage = asyncHandler(async (req,res)=>{
  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
    throw new ApiError(400,"coverImage file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400,"Error while uploading coverImage file")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage:coverImage.url
      }
    },
    {new:true} //it will return the updated information
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"cover image updated")
  )

})

export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar ,
  updateUsercoverImage
 };
